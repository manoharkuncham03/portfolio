import { z } from 'zod';
import { DatabasePool } from './database-pool';
import { embeddingService, EmbeddingResult } from './embeddings-service';
import { RedisClient, CACHE_PREFIXES, TTL } from './redis-client';

// Schema definitions
const SearchQuerySchema = z.object({
  query: z.string().min(1),
  contentTypes: z.array(z.string()).default([]),
  maxResults: z.number().default(10).min(1).max(100),
  similarityThreshold: z.number().default(0.7).min(0).max(1),
  includeKeywordSearch: z.boolean().default(true),
  includeSemanticSearch: z.boolean().default(true),
  contextTypes: z.array(z.string()).default(['content', 'conversation']),
});

const ContentChunkSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string().optional(),
  content: z.string(),
  metadata: z.record(z.any()).optional(),
  embedding: z.array(z.number()).optional(),
  keywords: z.string().optional(),
  relevanceScore: z.number().default(0),
  source: z.string().default('unknown'),
});

// Configuration interfaces
export interface RAGConfig {
  semanticWeight: number;
  keywordWeight: number;
  diversityWeight: number;
  maxContentLength: number;
  chunkSize: number;
  chunkOverlap: number;
  relevanceThreshold: number;
  maxContextChunks: number;
  enableQueryExpansion: boolean;
  enableIntentDetection: boolean;
  enableDeduplication: boolean;
  cacheEnabled: boolean;
}

export interface SearchQuery {
  query: string;
  contentTypes?: string[];
  maxResults?: number;
  similarityThreshold?: number;
  includeKeywordSearch?: boolean;
  includeSemanticSearch?: boolean;
  contextTypes?: string[];
}

export interface ContentChunk {
  id: string;
  type: string;
  title?: string;
  content: string;
  metadata?: Record<string, any>;
  embedding?: number[];
  keywords?: string;
  relevanceScore: number;
  source: string;
}

export interface SearchResult {
  chunks: ContentChunk[];
  totalResults: number;
  searchTime: number;
  cacheHit: boolean;
  semanticResults: number;
  keywordResults: number;
  mergedResults: number;
  queryIntent?: string;
  expandedQueries?: string[];
}

export interface ContextAssembly {
  content: string;
  sources: string[];
  relevanceScore: number;
  chunks: ContentChunk[];
  totalTokens: number;
  truncated: boolean;
}

export interface QueryIntent {
  intent: string;
  confidence: number;
  entities: Array<{ entity: string; type: string; confidence: number }>;
  keywords: string[];
}

export interface SynonymExpansion {
  originalQuery: string;
  expandedQueries: string[];
  synonymGroups: Array<{ original: string; synonyms: string[] }>;
}

// Default configuration
const DEFAULT_CONFIG: RAGConfig = {
  semanticWeight: 0.7,
  keywordWeight: 0.3,
  diversityWeight: 0.1,
  maxContentLength: 4000,
  chunkSize: 500,
  chunkOverlap: 100,
  relevanceThreshold: 0.6,
  maxContextChunks: 10,
  enableQueryExpansion: true,
  enableIntentDetection: true,
  enableDeduplication: true,
  cacheEnabled: true,
};

// Intent patterns for detection
const INTENT_PATTERNS = {
  greeting: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'],
  contact: ['contact', 'email', 'phone', 'reach', 'connect', 'get in touch'],
  experience: ['experience', 'work', 'job', 'career', 'employment', 'professional'],
  projects: ['project', 'build', 'develop', 'create', 'portfolio', 'work'],
  skills: ['skill', 'technology', 'programming', 'language', 'tool', 'expertise'],
  education: ['education', 'degree', 'study', 'university', 'college', 'academic'],
  personal: ['about', 'who', 'person', 'background', 'biography', 'profile'],
  technical: ['technical', 'code', 'implementation', 'architecture', 'system'],
  availability: ['available', 'hire', 'opportunity', 'job', 'position', 'freelance'],
};

// Synonym mappings for query expansion
const SYNONYM_MAPPINGS = {
  'experience': ['work', 'job', 'career', 'employment', 'professional background'],
  'skills': ['abilities', 'expertise', 'competencies', 'technologies', 'proficiencies'],
  'projects': ['work', 'portfolio', 'applications', 'systems', 'developments'],
  'education': ['academic', 'degree', 'studies', 'qualification', 'learning'],
  'contact': ['reach', 'connect', 'get in touch', 'communication', 'details'],
  'build': ['develop', 'create', 'construct', 'implement', 'design'],
  'technology': ['tech', 'tool', 'framework', 'platform', 'software'],
};

class RAGPipeline {
  private static instance: RAGPipeline;
  private config: RAGConfig;
  private db: DatabasePool;
  private redis: RedisClient;
  private embeddings: typeof embeddingService;

  private constructor(config?: Partial<RAGConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.db = DatabasePool.getInstance();
    this.redis = RedisClient.getInstance();
    this.embeddings = embeddingService;
  }

  public static getInstance(config?: Partial<RAGConfig>): RAGPipeline {
    if (!RAGPipeline.instance) {
      RAGPipeline.instance = new RAGPipeline(config);
    }
    return RAGPipeline.instance;
  }

  // Main search method combining semantic and keyword search
  public async search(searchQuery: SearchQuery): Promise<SearchResult> {
    const startTime = Date.now();
    
    // Validate input
    const validatedQuery = SearchQuerySchema.parse(searchQuery);
    
    // Check cache first
    const cacheKey = this.generateCacheKey(validatedQuery);
    if (this.config.cacheEnabled) {
      const cached = await this.getCachedResult(cacheKey);
      if (cached) {
        return { ...cached, cacheHit: true, searchTime: Date.now() - startTime };
      }
    }

    // Preprocess query
    const preprocessedQuery = await this.preprocessQuery(validatedQuery.query);
    
    // Detect intent
    let queryIntent: string | undefined;
    if (this.config.enableIntentDetection) {
      const intent = this.detectIntent(preprocessedQuery);
      queryIntent = intent.intent;
    }

    // Expand query if enabled
    let expandedQueries: string[] = [preprocessedQuery];
    if (this.config.enableQueryExpansion) {
      const expansion = this.expandQuery(preprocessedQuery);
      expandedQueries = expansion.expandedQueries;
    }

    // Perform searches
    const [semanticResults, keywordResults] = await Promise.all([
      validatedQuery.includeSemanticSearch 
        ? this.performSemanticSearch(expandedQueries, validatedQuery)
        : Promise.resolve([]),
      validatedQuery.includeKeywordSearch 
        ? this.performKeywordSearch(expandedQueries, validatedQuery)
        : Promise.resolve([]),
    ]);

    // Merge and rank results
    const mergedResults = this.mergeAndRankResults(semanticResults, keywordResults);
    
    // Deduplicate if enabled
    const finalResults = this.config.enableDeduplication 
      ? this.deduplicateResults(mergedResults)
      : mergedResults;

    // Apply relevance threshold
    const filteredResults = finalResults.filter(
      chunk => chunk.relevanceScore >= this.config.relevanceThreshold
    );

    // Limit results
    const limitedResults = filteredResults.slice(0, validatedQuery.maxResults);

    const searchResult: SearchResult = {
      chunks: limitedResults,
      totalResults: filteredResults.length,
      searchTime: Date.now() - startTime,
      cacheHit: false,
      semanticResults: semanticResults.length,
      keywordResults: keywordResults.length,
      mergedResults: mergedResults.length,
      queryIntent,
      expandedQueries: expandedQueries.length > 1 ? expandedQueries : undefined,
    };

    // Cache result
    if (this.config.cacheEnabled) {
      await this.setCachedResult(cacheKey, searchResult);
    }

    return searchResult;
  }

  // Semantic search using vector embeddings
  private async performSemanticSearch(
    queries: string[],
    searchQuery: SearchQuery
  ): Promise<ContentChunk[]> {
    const allResults: ContentChunk[] = [];

    for (const query of queries) {
      try {
        // Generate embedding for query
        const queryEmbedding = await this.embeddings.generateEmbedding(query);
        
        // Search database
        const dbResults = await this.db.query(
          `SELECT * FROM find_similar_content($1, $2, $3, $4)`,
          [
            JSON.stringify(queryEmbedding.embedding),
            searchQuery.contentTypes?.length ? searchQuery.contentTypes[0] : null,
            searchQuery.similarityThreshold || 0.7,
            searchQuery.maxResults || 10,
          ]
        );

        // Convert to ContentChunk format
        for (const row of dbResults.rows) {
          allResults.push({
            id: row.id.toString(),
            type: row.type,
            title: row.title,
            content: row.content,
            metadata: row.metadata,
            relevanceScore: row.similarity,
            source: 'semantic',
          });
        }

        // Also search conversation context if enabled
        if (searchQuery.contextTypes?.includes('conversation')) {
          const conversationResults = await this.db.query(
            `SELECT * FROM find_similar_conversations($1, NULL, $2, $3)`,
            [
              JSON.stringify(queryEmbedding.embedding),
              searchQuery.similarityThreshold || 0.7,
              Math.min(searchQuery.maxResults || 10, 5),
            ]
          );

          for (const row of conversationResults.rows) {
            allResults.push({
              id: `conv_${row.id}`,
              type: 'conversation',
              content: `${row.user_message} ${row.bot_response}`,
              metadata: { 
                session_id: row.session_id,
                created_at: row.created_at,
                user_message: row.user_message,
                bot_response: row.bot_response,
              },
              relevanceScore: row.similarity,
              source: 'conversation',
            });
          }
        }
      } catch (error) {
        console.warn(`Semantic search failed for query: ${query}`, error);
      }
    }

    return allResults;
  }

  // Keyword-based search
  private async performKeywordSearch(
    queries: string[],
    searchQuery: SearchQuery
  ): Promise<ContentChunk[]> {
    const allResults: ContentChunk[] = [];

    for (const query of queries) {
      try {
        // Extract keywords
        const keywords = this.extractKeywords(query);
        
        // Build keyword search query
        const keywordQuery = keywords.map(kw => `%${kw.toLowerCase()}%`).join('|');
        
        // Search in portfolio content
        const dbResults = await this.db.query(
          `SELECT id, type, title, content, metadata, keywords
           FROM portfolio_content 
           WHERE status = 'active' 
           AND (
             LOWER(content) SIMILAR TO $1 
             OR LOWER(keywords) SIMILAR TO $1 
             OR LOWER(title) SIMILAR TO $1
           )
           ${searchQuery.contentTypes?.length ? 'AND type = ANY($2)' : ''}
           ORDER BY 
             CASE 
               WHEN LOWER(title) SIMILAR TO $1 THEN 3
               WHEN LOWER(keywords) SIMILAR TO $1 THEN 2
               ELSE 1
             END DESC
           LIMIT $${searchQuery.contentTypes?.length ? '3' : '2'}`,
          searchQuery.contentTypes?.length 
            ? [keywordQuery, searchQuery.contentTypes, searchQuery.maxResults || 10]
            : [keywordQuery, searchQuery.maxResults || 10]
        );

        // Calculate keyword relevance
        for (const row of dbResults.rows) {
          const relevanceScore = this.calculateKeywordRelevance(query, row.content, row.keywords);
          
          allResults.push({
            id: row.id.toString(),
            type: row.type,
            title: row.title,
            content: row.content,
            metadata: row.metadata,
            keywords: row.keywords,
            relevanceScore,
            source: 'keyword',
          });
        }

        // Search in simple portfolio content as fallback
        if (allResults.length < (searchQuery.maxResults || 10)) {
          const simpleResults = await this.db.query(
            `SELECT id, type, content, metadata, keywords 
             FROM portfolio_content_simple 
             WHERE LOWER(content) SIMILAR TO $1 OR LOWER(keywords) SIMILAR TO $1
             ORDER BY 
               CASE 
                 WHEN LOWER(keywords) SIMILAR TO $1 THEN 2
                 ELSE 1
               END DESC
             LIMIT $2`,
            [keywordQuery, Math.max(5, (searchQuery.maxResults || 10) - allResults.length)]
          );

          for (const row of simpleResults.rows) {
            const relevanceScore = this.calculateKeywordRelevance(query, row.content, row.keywords);
            
            allResults.push({
              id: `simple_${row.id}`,
              type: row.type,
              content: row.content,
              metadata: row.metadata,
              keywords: row.keywords,
              relevanceScore,
              source: 'keyword_simple',
            });
          }
        }
      } catch (error) {
        console.warn(`Keyword search failed for query: ${query}`, error);
      }
    }

    return allResults;
  }

  // Query preprocessing
  private async preprocessQuery(query: string): Promise<string> {
    return query
      .trim()
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ');
  }

  // Intent detection
  private detectIntent(query: string): QueryIntent {
    const words = query.toLowerCase().split(/\s+/);
    const intents: Array<{ intent: string; confidence: number }> = [];

    for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
      let matches = 0;
      for (const pattern of patterns) {
        if (query.includes(pattern)) {
          matches++;
        }
      }
      
      if (matches > 0) {
        intents.push({
          intent,
          confidence: matches / patterns.length,
        });
      }
    }

    // Sort by confidence and return the highest
    intents.sort((a, b) => b.confidence - a.confidence);
    
    const topIntent = intents[0] || { intent: 'general', confidence: 0.5 };
    
    return {
      intent: topIntent.intent,
      confidence: topIntent.confidence,
      entities: this.extractEntities(query),
      keywords: this.extractKeywords(query),
    };
  }

  // Entity extraction (simple implementation)
  private extractEntities(query: string): Array<{ entity: string; type: string; confidence: number }> {
    const entities: Array<{ entity: string; type: string; confidence: number }> = [];
    const words = query.toLowerCase().split(/\s+/);

    // Technology entities
    const techTerms = ['python', 'javascript', 'react', 'node.js', 'typescript', 'html', 'css', 'sql'];
    for (const term of techTerms) {
      if (words.includes(term)) {
        entities.push({ entity: term, type: 'technology', confidence: 0.9 });
      }
    }

    // Company entities
    const companies = ['consuy', 'google', 'microsoft', 'amazon', 'meta'];
    for (const company of companies) {
      if (words.includes(company)) {
        entities.push({ entity: company, type: 'company', confidence: 0.8 });
      }
    }

    return entities;
  }

  // Query expansion with synonyms
  private expandQuery(query: string): SynonymExpansion {
    const words = query.toLowerCase().split(/\s+/);
    const expandedQueries = [query];
    const synonymGroups: Array<{ original: string; synonyms: string[] }> = [];

    for (const word of words) {
      if (SYNONYM_MAPPINGS[word]) {
        const synonyms = SYNONYM_MAPPINGS[word];
        synonymGroups.push({ original: word, synonyms });
        
        // Create expanded queries by replacing original word with synonyms
        for (const synonym of synonyms) {
          const expandedQuery = query.replace(new RegExp(`\\b${word}\\b`, 'gi'), synonym);
          if (!expandedQueries.includes(expandedQuery)) {
            expandedQueries.push(expandedQuery);
          }
        }
      }
    }

    return {
      originalQuery: query,
      expandedQueries,
      synonymGroups,
    };
  }

  // Keyword extraction
  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'can', 'about', 'what', 'how',
    ]);

    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .filter((word, index, arr) => arr.indexOf(word) === index); // Deduplicate
  }

  // Calculate keyword relevance score
  private calculateKeywordRelevance(query: string, content: string, keywords?: string): number {
    const queryKeywords = this.extractKeywords(query);
    const contentKeywords = this.extractKeywords(content.toLowerCase());
    const keywordList = keywords ? this.extractKeywords(keywords.toLowerCase()) : [];
    
    let matches = 0;
    let totalKeywords = queryKeywords.length;

    for (const keyword of queryKeywords) {
      // Exact matches in content get higher score
      if (contentKeywords.includes(keyword)) {
        matches += 1.0;
      }
      // Matches in keyword list get medium score
      else if (keywordList.includes(keyword)) {
        matches += 0.7;
      }
      // Partial matches get lower score
      else if (content.toLowerCase().includes(keyword)) {
        matches += 0.5;
      }
    }

    return totalKeywords > 0 ? matches / totalKeywords : 0;
  }

  // Merge and rank results from different search methods
  private mergeAndRankResults(
    semanticResults: ContentChunk[],
    keywordResults: ContentChunk[]
  ): ContentChunk[] {
    const combinedResults = new Map<string, ContentChunk>();

    // Add semantic results
    for (const result of semanticResults) {
      const key = `${result.type}_${result.id}`;
      combinedResults.set(key, {
        ...result,
        relevanceScore: result.relevanceScore * this.config.semanticWeight,
      });
    }

    // Add or merge keyword results
    for (const result of keywordResults) {
      const key = `${result.type}_${result.id}`;
      const existing = combinedResults.get(key);
      
      if (existing) {
        // Merge scores from both methods
        existing.relevanceScore += result.relevanceScore * this.config.keywordWeight;
        existing.source = 'hybrid';
      } else {
        combinedResults.set(key, {
          ...result,
          relevanceScore: result.relevanceScore * this.config.keywordWeight,
        });
      }
    }

    // Convert to array and sort by relevance
    const results = Array.from(combinedResults.values());
    
    // Apply diversity weighting
    if (this.config.diversityWeight > 0) {
      this.applyDiversityWeighting(results);
    }

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  // Apply diversity weighting to promote result diversity
  private applyDiversityWeighting(results: ContentChunk[]): void {
    const typeCounts = new Map<string, number>();
    
    for (const result of results) {
      const count = typeCounts.get(result.type) || 0;
      typeCounts.set(result.type, count + 1);
      
      // Reduce score for repeated types
      if (count > 0) {
        result.relevanceScore *= (1 - this.config.diversityWeight * count * 0.1);
      }
    }
  }

  // Deduplicate results based on content similarity
  private deduplicateResults(results: ContentChunk[]): ContentChunk[] {
    const deduplicated: ContentChunk[] = [];
    const seenContent = new Set<string>();

    for (const result of results) {
      // Create a normalized version of content for comparison
      const normalizedContent = result.content
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 200); // Use first 200 chars for comparison

      if (!seenContent.has(normalizedContent)) {
        seenContent.add(normalizedContent);
        deduplicated.push(result);
      }
    }

    return deduplicated;
  }

  // Assemble context from search results
  public assembleContext(chunks: ContentChunk[]): ContextAssembly {
    let totalTokens = 0;
    let assembledContent = '';
    const sources: string[] = [];
    const usedChunks: ContentChunk[] = [];
    let truncated = false;

    // Sort chunks by relevance
    const sortedChunks = [...chunks].sort((a, b) => b.relevanceScore - a.relevanceScore);

    for (const chunk of sortedChunks) {
      const chunkTokens = this.estimateTokens(chunk.content);
      
      if (totalTokens + chunkTokens > this.config.maxContentLength) {
        truncated = true;
        break;
      }

      // Add chunk content
      if (assembledContent) {
        assembledContent += '\n\n';
      }
      
      assembledContent += `${chunk.type.toUpperCase()}: ${chunk.content}`;
      
      if (chunk.title) {
        assembledContent = `${chunk.title}\n${assembledContent}`;
      }

      totalTokens += chunkTokens;
      usedChunks.push(chunk);
      
      // Track sources
      if (!sources.includes(chunk.source)) {
        sources.push(chunk.source);
      }

      // Limit number of chunks
      if (usedChunks.length >= this.config.maxContextChunks) {
        truncated = true;
        break;
      }
    }

    // Calculate overall relevance score
    const relevanceScore = usedChunks.length > 0
      ? usedChunks.reduce((sum, chunk) => sum + chunk.relevanceScore, 0) / usedChunks.length
      : 0;

    return {
      content: assembledContent,
      sources,
      relevanceScore,
      chunks: usedChunks,
      totalTokens,
      truncated,
    };
  }

  // Estimate token count (rough approximation)
  private estimateTokens(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  // Cache management
  private generateCacheKey(query: SearchQuery): string {
    const keyData = {
      query: query.query,
      contentTypes: query.contentTypes?.sort(),
      maxResults: query.maxResults,
      similarityThreshold: query.similarityThreshold,
      includeKeywordSearch: query.includeKeywordSearch,
      includeSemanticSearch: query.includeSemanticSearch,
      contextTypes: query.contextTypes?.sort(),
    };
    
    const keyString = JSON.stringify(keyData);
    return `${CACHE_PREFIXES.RAG_SEARCH}${this.hashString(keyString)}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private async getCachedResult(cacheKey: string): Promise<SearchResult | null> {
    try {
      return await this.redis.get<SearchResult>(cacheKey);
    } catch (error) {
      console.warn('Failed to get cached search result:', error);
      return null;
    }
  }

  private async setCachedResult(cacheKey: string, result: SearchResult): Promise<void> {
    try {
      await this.redis.set(cacheKey, result, TTL.SEARCH_RESULTS);
    } catch (error) {
      console.warn('Failed to cache search result:', error);
    }
  }

  // Configuration management
  public updateConfig(config: Partial<RAGConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): RAGConfig {
    return { ...this.config };
  }

  // Cleanup
  public async cleanup(): Promise<void> {
    // Clear any resources if needed
  }
}

// Export singleton instance
export const ragPipeline = RAGPipeline.getInstance();

// Export class for custom configurations
export { RAGPipeline };

// Export types
export type {
  RAGConfig,
  SearchQuery,
  ContentChunk,
  SearchResult,
  ContextAssembly,
  QueryIntent,
  SynonymExpansion,
};

// Utility functions
export async function searchContent(query: string, options?: Partial<SearchQuery>): Promise<SearchResult> {
  return ragPipeline.search({ query, ...options });
}

export async function assembleContextFromQuery(query: string, options?: Partial<SearchQuery>): Promise<ContextAssembly> {
  const searchResult = await ragPipeline.search({ query, ...options });
  return ragPipeline.assembleContext(searchResult.chunks);
}

export async function findSimilarContent(
  content: string, 
  contentType?: string,
  maxResults: number = 5
): Promise<ContentChunk[]> {
  const searchResult = await ragPipeline.search({
    query: content,
    contentTypes: contentType ? [contentType] : [],
    maxResults,
    includeKeywordSearch: false,
    includeSemanticSearch: true,
  });
  
  return searchResult.chunks;
}
