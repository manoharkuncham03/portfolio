import OpenAI from 'openai';
import { z } from 'zod';
import { redisClient } from './redis-client';
import { createClient } from '@supabase/supabase-js';

// Configuration schema
const EmbeddingConfigSchema = z.object({
  apiKey: z.string(),
  model: z.string().default('text-embedding-ada-002'),
  dimensions: z.number().default(1536),
  maxTokens: z.number().default(8191),
  batchSize: z.number().default(100),
  rateLimitRpm: z.number().default(3000),
  rateLimitTpm: z.number().default(1000000),
});

// Input validation schemas
const TextChunkSchema = z.object({
  text: z.string().min(1),
  metadata: z.record(z.any()).optional(),
  id: z.string().optional(),
});

const BatchEmbeddingRequestSchema = z.object({
  texts: z.array(z.string()).min(1),
  metadata: z.record(z.any()).optional(),
});

// Response types
export interface EmbeddingResult {
  text: string;
  embedding: number[];
  dimensions: number;
  model: string;
  tokens: number;
  cached: boolean;
  metadata?: Record<string, any>;
}

export interface BatchEmbeddingResult {
  results: EmbeddingResult[];
  totalTokens: number;
  cached: number;
  generated: number;
  errors: string[];
}

export interface TextChunk {
  text: string;
  metadata?: Record<string, any>;
  id?: string;
}

export interface SimilarityResult {
  score: number;
  text: string;
  metadata?: Record<string, any>;
}

// Rate limiting interface
interface RateLimiter {
  tokens: number;
  requests: number;
  resetTime: number;
}

class VectorEmbeddingService {
  private static instance: VectorEmbeddingService;
  private openai: OpenAI;
  private config: z.infer<typeof EmbeddingConfigSchema>;
  private supabase: any;
  private rateLimiter: RateLimiter;
  private requestQueue: Array<() => Promise<void>> = [];
  private isProcessingQueue = false;

  private constructor() {
    this.config = EmbeddingConfigSchema.parse({
      apiKey: process.env.OPENAI_API_KEY!,
      model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-ada-002',
      dimensions: parseInt(process.env.OPENAI_EMBEDDING_DIMENSIONS || '1536'),
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '8191'),
      batchSize: 100,
      rateLimitRpm: 3000,
      rateLimitTpm: 1000000,
    });

    this.openai = new OpenAI({
      apiKey: this.config.apiKey,
    });

    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    this.rateLimiter = {
      tokens: 0,
      requests: 0,
      resetTime: Date.now() + 60000, // Reset every minute
    };

    this.startQueueProcessor();
  }

  public static getInstance(): VectorEmbeddingService {
    if (!VectorEmbeddingService.instance) {
      VectorEmbeddingService.instance = new VectorEmbeddingService();
    }
    return VectorEmbeddingService.instance;
  }

  // Text preprocessing and chunking
  public preprocessText(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[\r\n]+/g, ' ') // Replace line breaks with spaces
      .replace(/[^\w\s.,!?;:-]/g, '') // Remove special characters except basic punctuation
      .substring(0, this.config.maxTokens * 4); // Rough token estimation (1 token ≈ 4 chars)
  }

  public chunkText(text: string, maxChunkSize: number = 1000, overlap: number = 100): TextChunk[] {
    const preprocessed = this.preprocessText(text);
    const chunks: TextChunk[] = [];
    
    if (preprocessed.length <= maxChunkSize) {
      return [{ text: preprocessed }];
    }

    let start = 0;
    let chunkIndex = 0;

    while (start < preprocessed.length) {
      const end = Math.min(start + maxChunkSize, preprocessed.length);
      let chunkEnd = end;

      // Try to break at sentence boundary
      if (end < preprocessed.length) {
        const lastSentence = preprocessed.lastIndexOf('.', end);
        const lastQuestion = preprocessed.lastIndexOf('?', end);
        const lastExclamation = preprocessed.lastIndexOf('!', end);
        
        const sentenceEnd = Math.max(lastSentence, lastQuestion, lastExclamation);
        if (sentenceEnd > start + maxChunkSize * 0.5) {
          chunkEnd = sentenceEnd + 1;
        }
      }

      const chunkText = preprocessed.substring(start, chunkEnd).trim();
      if (chunkText.length > 0) {
        chunks.push({
          text: chunkText,
          metadata: {
            chunkIndex,
            totalChunks: 0, // Will be updated after processing
            startPosition: start,
            endPosition: chunkEnd,
          },
          id: `chunk_${chunkIndex}`,
        });
        chunkIndex++;
      }

      start = Math.max(chunkEnd - overlap, start + 1);
    }

    // Update total chunks count
    chunks.forEach(chunk => {
      if (chunk.metadata) {
        chunk.metadata.totalChunks = chunks.length;
      }
    });

    return chunks;
  }

  // Rate limiting
  private async checkRateLimit(tokensNeeded: number): Promise<void> {
    const now = Date.now();
    
    // Reset rate limiter if minute has passed
    if (now >= this.rateLimiter.resetTime) {
      this.rateLimiter.tokens = 0;
      this.rateLimiter.requests = 0;
      this.rateLimiter.resetTime = now + 60000;
    }

    // Check if we're within limits
    if (
      this.rateLimiter.requests >= this.config.rateLimitRpm ||
      this.rateLimiter.tokens + tokensNeeded > this.config.rateLimitTpm
    ) {
      const waitTime = this.rateLimiter.resetTime - now;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.checkRateLimit(tokensNeeded);
    }
  }

  private updateRateLimit(tokensUsed: number): void {
    this.rateLimiter.tokens += tokensUsed;
    this.rateLimiter.requests += 1;
  }

  // Queue processing for batch operations
  private startQueueProcessor(): void {
    setInterval(async () => {
      if (!this.isProcessingQueue && this.requestQueue.length > 0) {
        this.isProcessingQueue = true;
        const request = this.requestQueue.shift();
        if (request) {
          try {
            await request();
          } catch (error) {
            console.error('Queue processing error:', error);
          }
        }
        this.isProcessingQueue = false;
      }
    }, 100);
  }

  // Caching utilities
  private getCacheKey(text: string, model: string): string {
    return `embedding:${model}:${Buffer.from(text).toString('base64')}`;
  }

  private async getCachedEmbedding(text: string): Promise<EmbeddingResult | null> {
    try {
      const cached = await redisClient.getCachedEmbedding(text);
      if (cached && cached.model === this.config.model) {
        return {
          text: cached.text,
          embedding: cached.embedding,
          dimensions: cached.dimensions,
          model: cached.model,
          tokens: Math.ceil(text.length / 4), // Estimate
          cached: true,
        };
      }
      return null;
    } catch (error) {
      console.error('Cache retrieval error:', error);
      return null;
    }
  }

  private async cacheEmbedding(text: string, embedding: number[], tokens: number): Promise<void> {
    try {
      await redisClient.cacheEmbedding(text, embedding, this.config.model);
    } catch (error) {
      console.error('Cache storage error:', error);
    }
  }

  // Core embedding generation
  public async generateEmbedding(text: string, useCache: boolean = true): Promise<EmbeddingResult> {
    const preprocessed = this.preprocessText(text);
    
    // Check cache first
    if (useCache) {
      const cached = await this.getCachedEmbedding(preprocessed);
      if (cached) {
        return cached;
      }
    }

    // Estimate tokens needed
    const estimatedTokens = Math.ceil(preprocessed.length / 4);
    await this.checkRateLimit(estimatedTokens);

    try {
      const response = await this.openai.embeddings.create({
        model: this.config.model,
        input: preprocessed,
      });

      const embedding = response.data[0].embedding;
      const tokens = response.usage.total_tokens;

      this.updateRateLimit(tokens);

      // Cache the result
      if (useCache) {
        await this.cacheEmbedding(preprocessed, embedding, tokens);
      }

      return {
        text: preprocessed,
        embedding,
        dimensions: embedding.length,
        model: this.config.model,
        tokens,
        cached: false,
      };
    } catch (error) {
      console.error('Embedding generation error:', error);
      throw new Error(`Failed to generate embedding: ${error}`);
    }
  }

  // Batch embedding generation with rate limiting
  public async generateBatchEmbeddings(
    texts: string[],
    useCache: boolean = true,
    maxRetries: number = 3
  ): Promise<BatchEmbeddingResult> {
    const validatedRequest = BatchEmbeddingRequestSchema.parse({ texts });
    const results: EmbeddingResult[] = [];
    const errors: string[] = [];
    let totalTokens = 0;
    let cached = 0;
    let generated = 0;

    // Process in batches
    const batches = this.createBatches(validatedRequest.texts, this.config.batchSize);

    for (const batch of batches) {
      const batchPromises = batch.map(async (text, index) => {
        let attempts = 0;
        while (attempts < maxRetries) {
          try {
            const result = await this.generateEmbedding(text, useCache);
            results.push(result);
            totalTokens += result.tokens;
            if (result.cached) {
              cached++;
            } else {
              generated++;
            }
            return;
          } catch (error) {
            attempts++;
            if (attempts >= maxRetries) {
              errors.push(`Failed to process text ${index}: ${error}`);
              return;
            }
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
          }
        }
      });

      await Promise.all(batchPromises);
    }

    return {
      results,
      totalTokens,
      cached,
      generated,
      errors,
    };
  }

  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  // Utility functions for cosine similarity
  public static cosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Vectors must have the same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  public static findMostSimilar(
    queryEmbedding: number[],
    embeddings: Array<{ embedding: number[]; text: string; metadata?: any }>,
    threshold: number = 0.7
  ): SimilarityResult[] {
    return embeddings
      .map(item => ({
        score: VectorEmbeddingService.cosineSimilarity(queryEmbedding, item.embedding),
        text: item.text,
        metadata: item.metadata,
      }))
      .filter(result => result.score >= threshold)
      .sort((a, b) => b.score - a.score);
  }

  // Database storage and retrieval methods
  public async storeEmbedding(
    contentId: number,
    contentType: string,
    text: string,
    embedding: number[],
    metadata?: Record<string, any>
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('vector_embeddings')
        .insert({
          content_id: contentId,
          content_type: contentType,
          content_text: text,
          embedding: `[${embedding.join(',')}]`,
          metadata: metadata || {},
        });

      if (error) {
        console.error('Database storage error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Store embedding error:', error);
      return false;
    }
  }

  public async retrieveSimilarEmbeddings(
    queryEmbedding: number[],
    contentType?: string,
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<Array<{ id: number; text: string; similarity: number; metadata: any }>> {
    try {
      let query = this.supabase.rpc('find_similar_content', {
        query_embedding: `[${queryEmbedding.join(',')}]`,
        content_type_filter: contentType,
        similarity_threshold: threshold,
        max_results: limit,
      });

      const { data, error } = await query;

      if (error) {
        console.error('Database retrieval error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Retrieve embeddings error:', error);
      return [];
    }
  }

  public async searchSimilarContent(
    queryText: string,
    contentType?: string,
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<Array<{ id: number; text: string; similarity: number; metadata: any }>> {
    try {
      // Generate embedding for query
      const queryResult = await this.generateEmbedding(queryText);
      
      // Search for similar content
      return await this.retrieveSimilarEmbeddings(
        queryResult.embedding,
        contentType,
        limit,
        threshold
      );
    } catch (error) {
      console.error('Search similar content error:', error);
      return [];
    }
  }

  // Bulk operations for portfolio content
  public async processPortfolioContent(
    content: Array<{ type: string; title: string; content: string; metadata?: any }>
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const item of content) {
      try {
        // Chunk large content
        const chunks = this.chunkText(item.content);
        
        for (const chunk of chunks) {
          // Generate embedding
          const embeddingResult = await this.generateEmbedding(chunk.text);
          
          // Store in database
          const stored = await this.storeEmbedding(
            0, // Will be updated with actual content ID
            item.type,
            chunk.text,
            embeddingResult.embedding,
            {
              ...item.metadata,
              ...chunk.metadata,
              title: item.title,
            }
          );

          if (stored) {
            success++;
          } else {
            failed++;
            errors.push(`Failed to store chunk for ${item.title}`);
          }
        }
      } catch (error) {
        failed++;
        errors.push(`Failed to process ${item.title}: ${error}`);
      }
    }

    return { success, failed, errors };
  }

  // Health check and diagnostics
  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  }> {
    const details: Record<string, any> = {};

    try {
      // Test OpenAI connection
      const testEmbedding = await this.openai.embeddings.create({
        model: this.config.model,
        input: 'test',
      });
      details.openai = { status: 'healthy', model: this.config.model };
    } catch (error) {
      details.openai = { status: 'unhealthy', error: String(error) };
    }

    try {
      // Test Redis connection
      const cacheHealthy = await redisClient.healthCheck();
      details.cache = { status: cacheHealthy ? 'healthy' : 'unhealthy' };
    } catch (error) {
      details.cache = { status: 'unhealthy', error: String(error) };
    }

    try {
      // Test database connection
      const { data, error } = await this.supabase.from('vector_embeddings').select('count').limit(1);
      details.database = { status: error ? 'unhealthy' : 'healthy', error };
    } catch (error) {
      details.database = { status: 'unhealthy', error: String(error) };
    }

    // Determine overall status
    const statuses = Object.values(details).map(d => d.status);
    const status = statuses.includes('unhealthy') 
      ? 'unhealthy' 
      : statuses.includes('degraded') 
        ? 'degraded' 
        : 'healthy';

    return { status, details };
  }
}

// Export singleton instance
export const vectorEmbeddingService = VectorEmbeddingService.getInstance();

// Export types and utilities
export { VectorEmbeddingService };
export default vectorEmbeddingService;
