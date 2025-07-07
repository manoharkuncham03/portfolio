import { pipeline, env } from '@xenova/transformers';
import { z } from 'zod';
import { RedisClient, CACHE_PREFIXES, TTL, CachedEmbedding } from './redis-client';

// Configure Transformers.js environment
env.allowLocalModels = false;
env.allowRemoteModels = true;

// Schema definitions
const EmbeddingRequestSchema = z.object({
  text: z.string().min(1),
  model: z.string().default('sentence-transformers/all-MiniLM-L6-v2'),
  dimensions: z.number().optional(),
});

const BatchEmbeddingRequestSchema = z.object({
  texts: z.array(z.string().min(1)),
  model: z.string().default('sentence-transformers/all-MiniLM-L6-v2'),
  dimensions: z.number().optional(),
  chunkSize: z.number().default(100).min(1).max(1000),
});

// Configuration interfaces
export interface EmbeddingConfig {
  model: string;
  maxTokens: number;
  dimensions: number;
  chunkSize: number;
  chunkOverlap: number;
  cacheEnabled: boolean;
  fallbackEnabled: boolean;
  performanceTracking: boolean;
}

export interface EmbeddingResult {
  embedding: number[];
  text: string;
  model: string;
  dimensions: number;
  processingTime: number;
  fromCache: boolean;
  chunks?: string[];
}

export interface BatchEmbeddingResult {
  embeddings: EmbeddingResult[];
  totalProcessingTime: number;
  cacheHits: number;
  cacheMisses: number;
  failedCount: number;
  errors: string[];
}

export interface SimilarityResult {
  similarity: number;
  distance: number;
}

export interface EmbeddingMetrics {
  totalRequests: number;
  cacheHitRate: number;
  averageProcessingTime: number;
  modelLoadTime: number;
  failureRate: number;
  lastReset: number;
}

// Default configuration
const DEFAULT_CONFIG: EmbeddingConfig = {
  model: 'sentence-transformers/all-MiniLM-L6-v2',
  maxTokens: 512,
  dimensions: 384,
  chunkSize: 200,
  chunkOverlap: 50,
  cacheEnabled: true,
  fallbackEnabled: true,
  performanceTracking: true,
};

class EmbeddingService {
  private static instance: EmbeddingService;
  private model: any = null;
  private modelLoading: Promise<any> | null = null;
  private config: EmbeddingConfig;
  private redis: RedisClient;
  private metrics: EmbeddingMetrics = {
    totalRequests: 0,
    cacheHitRate: 0,
    averageProcessingTime: 0,
    modelLoadTime: 0,
    failureRate: 0,
    lastReset: Date.now(),
  };
  private processingTimes: number[] = [];
  private readonly maxMetricsHistory = 1000;

  private constructor(config?: Partial<EmbeddingConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.redis = RedisClient.getInstance();
  }

  public static getInstance(config?: Partial<EmbeddingConfig>): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService(config);
    }
    return EmbeddingService.instance;
  }

  // Model management
  private async loadModel(): Promise<any> {
    if (this.model) {
      return this.model;
    }

    if (this.modelLoading) {
      return this.modelLoading;
    }

    const startTime = Date.now();
    
    this.modelLoading = pipeline('feature-extraction', this.config.model, {
      quantized: true,
      revision: 'main',
    });

    try {
      this.model = await this.modelLoading;
      this.metrics.modelLoadTime = Date.now() - startTime;
      console.log(`Embedding model loaded in ${this.metrics.modelLoadTime}ms`);
      return this.model;
    } catch (error) {
      this.modelLoading = null;
      throw new Error(`Failed to load embedding model: ${error}`);
    }
  }

  // Text preprocessing and chunking
  private preprocessText(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s.,!?;:()-]/g, '')
      .toLowerCase();
  }

  private chunkText(text: string): string[] {
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    
    if (words.length <= this.config.chunkSize) {
      return [text];
    }

    for (let i = 0; i < words.length; i += this.config.chunkSize - this.config.chunkOverlap) {
      const chunk = words.slice(i, i + this.config.chunkSize).join(' ');
      if (chunk.trim()) {
        chunks.push(chunk);
      }
    }

    return chunks;
  }

  // Cache management
  private getCacheKey(text: string, model: string): string {
    const hash = this.hashText(text + model);
    return `${CACHE_PREFIXES.EMBEDDING}${hash}`;
  }

  private hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private async getCachedEmbedding(text: string, model: string): Promise<CachedEmbedding | null> {
    if (!this.config.cacheEnabled) {
      return null;
    }

    try {
      const cacheKey = this.getCacheKey(text, model);
      const cached = await this.redis.get<CachedEmbedding>(cacheKey);
      return cached;
    } catch (error) {
      console.warn('Failed to retrieve cached embedding:', error);
      return null;
    }
  }

  private async setCachedEmbedding(
    text: string,
    embedding: number[],
    model: string
  ): Promise<void> {
    if (!this.config.cacheEnabled) {
      return;
    }

    try {
      const cacheKey = this.getCacheKey(text, model);
      const cachedEmbedding: CachedEmbedding = {
        text,
        embedding,
        model,
        timestamp: Date.now(),
        dimensions: embedding.length,
      };
      
      await this.redis.set(cacheKey, cachedEmbedding, TTL.EMBEDDINGS);
    } catch (error) {
      console.warn('Failed to cache embedding:', error);
    }
  }

  // Core embedding generation
  private async generateEmbeddingInternal(text: string): Promise<number[]> {
    const model = await this.loadModel();
    const preprocessed = this.preprocessText(text);
    
    const output = await model(preprocessed, {
      pooling: 'mean',
      normalize: true,
    });

    return Array.from(output.data);
  }

  // Public embedding methods
  public async generateEmbedding(
    text: string,
    options?: { model?: string; useCache?: boolean }
  ): Promise<EmbeddingResult> {
    const startTime = Date.now();
    const model = options?.model || this.config.model;
    const useCache = options?.useCache ?? this.config.cacheEnabled;

    try {
      // Validate input
      EmbeddingRequestSchema.parse({ text, model });

      // Check cache first
      let cachedEmbedding: CachedEmbedding | null = null;
      if (useCache) {
        cachedEmbedding = await this.getCachedEmbedding(text, model);
      }

      if (cachedEmbedding) {
        const processingTime = Date.now() - startTime;
        this.updateMetrics(processingTime, true, false);
        
        return {
          embedding: cachedEmbedding.embedding,
          text,
          model,
          dimensions: cachedEmbedding.dimensions,
          processingTime,
          fromCache: true,
        };
      }

      // Generate new embedding
      const chunks = this.chunkText(text);
      let finalEmbedding: number[];

      if (chunks.length === 1) {
        finalEmbedding = await this.generateEmbeddingInternal(chunks[0]);
      } else {
        // For multiple chunks, generate embeddings and average them
        const chunkEmbeddings = await Promise.all(
          chunks.map(chunk => this.generateEmbeddingInternal(chunk))
        );
        
        finalEmbedding = this.averageEmbeddings(chunkEmbeddings);
      }

      // Cache the result
      if (useCache) {
        await this.setCachedEmbedding(text, finalEmbedding, model);
      }

      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, false, false);

      return {
        embedding: finalEmbedding,
        text,
        model,
        dimensions: finalEmbedding.length,
        processingTime,
        fromCache: false,
        chunks: chunks.length > 1 ? chunks : undefined,
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, false, true);

      if (this.config.fallbackEnabled) {
        return this.handleFallback(text, model, error);
      }

      throw new Error(`Embedding generation failed: ${error}`);
    }
  }

  public async generateBatchEmbeddings(
    texts: string[],
    options?: { model?: string; chunkSize?: number; useCache?: boolean }
  ): Promise<BatchEmbeddingResult> {
    const startTime = Date.now();
    const model = options?.model || this.config.model;
    const chunkSize = options?.chunkSize || 10;
    const useCache = options?.useCache ?? this.config.cacheEnabled;

    // Validate input
    BatchEmbeddingRequestSchema.parse({
      texts,
      model,
      chunkSize,
    });

    const results: EmbeddingResult[] = [];
    const errors: string[] = [];
    let cacheHits = 0;
    let cacheMisses = 0;
    let failedCount = 0;

    // Process in chunks to avoid overwhelming the system
    for (let i = 0; i < texts.length; i += chunkSize) {
      const batch = texts.slice(i, i + chunkSize);
      const batchPromises = batch.map(async (text, index) => {
        try {
          const result = await this.generateEmbedding(text, { model, useCache });
          if (result.fromCache) {
            cacheHits++;
          } else {
            cacheMisses++;
          }
          return result;
        } catch (error) {
          failedCount++;
          errors.push(`Text ${i + index}: ${error}`);
          return null;
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
        }
      }
    }

    const totalProcessingTime = Date.now() - startTime;

    return {
      embeddings: results,
      totalProcessingTime,
      cacheHits,
      cacheMisses,
      failedCount,
      errors,
    };
  }

  // Similarity calculations
  public calculateCosineSimilarity(a: number[], b: number[]): SimilarityResult {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return { similarity: 0, distance: 1 };
    }

    const similarity = dotProduct / (normA * normB);
    const distance = 1 - similarity;

    return { similarity, distance };
  }

  public calculateEuclideanDistance(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same dimensions');
    }

    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }

    return Math.sqrt(sum);
  }

  // Utility methods
  private averageEmbeddings(embeddings: number[][]): number[] {
    if (embeddings.length === 0) {
      throw new Error('Cannot average empty embeddings array');
    }

    const dimensions = embeddings[0].length;
    const averaged = new Array(dimensions).fill(0);

    for (const embedding of embeddings) {
      if (embedding.length !== dimensions) {
        throw new Error('All embeddings must have the same dimensions');
      }
      
      for (let i = 0; i < dimensions; i++) {
        averaged[i] += embedding[i];
      }
    }

    for (let i = 0; i < dimensions; i++) {
      averaged[i] /= embeddings.length;
    }

    return averaged;
  }

  private async handleFallback(
    text: string,
    model: string,
    error: any
  ): Promise<EmbeddingResult> {
    console.warn(`Embedding generation failed, using fallback for: ${text.substring(0, 50)}...`);
    
    // Generate a simple hash-based embedding as fallback
    const fallbackEmbedding = this.generateHashEmbedding(text);
    
    return {
      embedding: fallbackEmbedding,
      text,
      model: `${model}-fallback`,
      dimensions: fallbackEmbedding.length,
      processingTime: 0,
      fromCache: false,
    };
  }

  private generateHashEmbedding(text: string): number[] {
    const dimensions = this.config.dimensions;
    const embedding = new Array(dimensions).fill(0);
    
    // Simple hash-based embedding generation
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const index = (charCode * (i + 1)) % dimensions;
      embedding[index] += Math.sin(charCode + i) * 0.1;
    }
    
    // Normalize the embedding
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      for (let i = 0; i < dimensions; i++) {
        embedding[i] /= norm;
      }
    }
    
    return embedding;
  }

  // Metrics and monitoring
  private updateMetrics(processingTime: number, fromCache: boolean, failed: boolean): void {
    if (!this.config.performanceTracking) {
      return;
    }

    this.metrics.totalRequests++;
    
    if (failed) {
      this.metrics.failureRate = 
        (this.metrics.failureRate * (this.metrics.totalRequests - 1) + 1) / 
        this.metrics.totalRequests;
    }

    if (!failed) {
      this.processingTimes.push(processingTime);
      
      if (this.processingTimes.length > this.maxMetricsHistory) {
        this.processingTimes.shift();
      }
      
      this.metrics.averageProcessingTime = 
        this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;
    }

    // Update cache hit rate (simplified calculation)
    if (fromCache) {
      this.metrics.cacheHitRate = 
        (this.metrics.cacheHitRate * (this.metrics.totalRequests - 1) + 1) / 
        this.metrics.totalRequests;
    } else {
      this.metrics.cacheHitRate = 
        (this.metrics.cacheHitRate * (this.metrics.totalRequests - 1)) / 
        this.metrics.totalRequests;
    }
  }

  public getMetrics(): EmbeddingMetrics {
    return { ...this.metrics };
  }

  public resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      cacheHitRate: 0,
      averageProcessingTime: 0,
      modelLoadTime: this.metrics.modelLoadTime,
      failureRate: 0,
      lastReset: Date.now(),
    };
    this.processingTimes = [];
  }

  // Configuration management
  public updateConfig(config: Partial<EmbeddingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): EmbeddingConfig {
    return { ...this.config };
  }

  // Validation methods
  public validateEmbedding(embedding: number[]): boolean {
    if (!Array.isArray(embedding) || embedding.length === 0) {
      return false;
    }

    if (embedding.length !== this.config.dimensions) {
      return false;
    }

    return embedding.every(val => typeof val === 'number' && !isNaN(val));
  }

  // Cleanup
  public async cleanup(): Promise<void> {
    this.model = null;
    this.modelLoading = null;
    this.resetMetrics();
  }
}

// Export singleton instance
export const embeddingService = EmbeddingService.getInstance();

// Export class for custom configurations
export { EmbeddingService };

// Export types
export type {
  EmbeddingConfig,
  EmbeddingResult,
  BatchEmbeddingResult,
  SimilarityResult,
  EmbeddingMetrics,
};

// Utility functions
export async function generateEmbedding(text: string): Promise<number[]> {
  const result = await embeddingService.generateEmbedding(text);
  return result.embedding;
}

export async function calculateSimilarity(
  text1: string,
  text2: string
): Promise<number> {
  const [result1, result2] = await Promise.all([
    embeddingService.generateEmbedding(text1),
    embeddingService.generateEmbedding(text2),
  ]);

  const similarity = embeddingService.calculateCosineSimilarity(
    result1.embedding,
    result2.embedding
  );

  return similarity.similarity;
}
