import Redis from 'ioredis';
import { z } from 'zod';

// Environment configuration schema
const RedisConfigSchema = z.object({
  url: z.string().default('redis://localhost:6379'),
  password: z.string().optional(),
  db: z.number().default(0),
  maxRetries: z.number().default(3),
  retryDelay: z.number().default(5000),
});

// Typed interfaces for cached data structures
export interface CachedApiResponse {
  data: any;
  timestamp: number;
  ttl: number;
  metadata?: Record<string, any>;
}

export interface CachedEmbedding {
  text: string;
  embedding: number[];
  model: string;
  timestamp: number;
  dimensions: number;
}

export interface CachedConversation {
  sessionId: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
  lastActivity: number;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  lastReset: number;
}

// Cache key prefixes
export const CACHE_PREFIXES = {
  API_RESPONSE: 'api:response:',
  EMBEDDING: 'embedding:',
  CONVERSATION: 'conversation:',
  METRICS: 'metrics:',
  HEALTH: 'health:',
} as const;

// TTL constants (in seconds)
export const TTL = {
  DEFAULT: parseInt(process.env.CACHE_TTL_DEFAULT || '300'),
  EMBEDDINGS: parseInt(process.env.CACHE_TTL_EMBEDDINGS || '3600'),
  API_RESPONSES: parseInt(process.env.CACHE_TTL_API_RESPONSES || '600'),
  CONVERSATION: parseInt(process.env.CACHE_TTL_CONVERSATION || '1800'),
  HEALTH_CHECK: 30,
} as const;

class RedisClient {
  private static instance: RedisClient;
  private client: Redis;
  private config: z.infer<typeof RedisConfigSchema>;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private healthCheckInterval?: NodeJS.Timeout;
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    lastReset: Date.now(),
  };

  private constructor() {
    this.config = RedisConfigSchema.parse({
      url: process.env.REDIS_URL,
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
      retryDelay: parseInt(process.env.REDIS_RETRY_DELAY || '5000'),
    });

    this.client = new Redis({
      ...this.parseRedisUrl(this.config.url),
      password: this.config.password,
      db: this.config.db,
      enableReadyCheck: true,
      maxRetriesPerRequest: this.config.maxRetries,
      lazyConnect: true,
      keepAlive: 30000,
      connectionName: 'portfolio-chatbot',
    });

    this.setupEventHandlers();
    this.startHealthCheck();
  }

  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  private parseRedisUrl(url: string): { host: string; port: number } {
    try {
      const parsed = new URL(url);
      return {
        host: parsed.hostname || 'localhost',
        port: parseInt(parsed.port) || 6379,
      };
    } catch {
      return { host: 'localhost', port: 6379 };
    }
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      console.log('Redis client connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.client.on('ready', () => {
      console.log('Redis client ready');
    });

    this.client.on('error', (error) => {
      console.error('Redis client error:', error);
      this.isConnected = false;
    });

    this.client.on('close', () => {
      console.log('Redis client connection closed');
      this.isConnected = false;
      this.handleReconnection();
    });

    this.client.on('reconnecting', () => {
      console.log('Redis client reconnecting...');
    });
  }

  private async handleReconnection(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.config.retryDelay * this.reconnectAttempts, 30000);
    
    setTimeout(async () => {
      try {
        await this.client.connect();
      } catch (error) {
        console.error('Reconnection failed:', error);
        this.handleReconnection();
      }
    }, delay);
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.healthCheck();
      } catch (error) {
        console.error('Health check failed:', error);
      }
    }, TTL.HEALTH_CHECK * 1000);
  }

  public async connect(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    await this.client.quit();
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      const isHealthy = result === 'PONG';
      
      await this.client.setex(
        `${CACHE_PREFIXES.HEALTH}check`,
        TTL.HEALTH_CHECK,
        JSON.stringify({
          status: isHealthy ? 'healthy' : 'unhealthy',
          timestamp: Date.now(),
          metrics: this.metrics,
        })
      );

      return isHealthy;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  // Generic cache operations
  public async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      if (value) {
        this.metrics.hits++;
        return JSON.parse(value);
      }
      this.metrics.misses++;
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      this.metrics.misses++;
      return null;
    }
  }

  public async set<T>(key: string, value: T, ttl: number = TTL.DEFAULT): Promise<boolean> {
    try {
      const result = await this.client.setex(key, ttl, JSON.stringify(value));
      this.metrics.sets++;
      return result === 'OK';
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  public async del(key: string): Promise<boolean> {
    try {
      const result = await this.client.del(key);
      this.metrics.deletes++;
      return result > 0;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  public async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result > 0;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  public async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      console.error('Cache TTL error:', error);
      return -1;
    }
  }

  public async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const result = await this.client.expire(key, seconds);
      return result === 1;
    } catch (error) {
      console.error('Cache expire error:', error);
      return false;
    }
  }

  // Specialized cache methods
  public async cacheApiResponse(key: string, data: any, ttl: number = TTL.API_RESPONSES): Promise<boolean> {
    const cacheKey = `${CACHE_PREFIXES.API_RESPONSE}${key}`;
    const cachedResponse: CachedApiResponse = {
      data,
      timestamp: Date.now(),
      ttl,
    };
    return this.set(cacheKey, cachedResponse, ttl);
  }

  public async getCachedApiResponse(key: string): Promise<CachedApiResponse | null> {
    const cacheKey = `${CACHE_PREFIXES.API_RESPONSE}${key}`;
    return this.get<CachedApiResponse>(cacheKey);
  }

  public async cacheEmbedding(text: string, embedding: number[], model: string, ttl: number = TTL.EMBEDDINGS): Promise<boolean> {
    const cacheKey = `${CACHE_PREFIXES.EMBEDDING}${Buffer.from(text).toString('base64')}`;
    const cachedEmbedding: CachedEmbedding = {
      text,
      embedding,
      model,
      timestamp: Date.now(),
      dimensions: embedding.length,
    };
    return this.set(cacheKey, cachedEmbedding, ttl);
  }

  public async getCachedEmbedding(text: string): Promise<CachedEmbedding | null> {
    const cacheKey = `${CACHE_PREFIXES.EMBEDDING}${Buffer.from(text).toString('base64')}`;
    return this.get<CachedEmbedding>(cacheKey);
  }

  public async cacheConversation(sessionId: string, conversation: CachedConversation, ttl: number = TTL.CONVERSATION): Promise<boolean> {
    const cacheKey = `${CACHE_PREFIXES.CONVERSATION}${sessionId}`;
    return this.set(cacheKey, conversation, ttl);
  }

  public async getCachedConversation(sessionId: string): Promise<CachedConversation | null> {
    const cacheKey = `${CACHE_PREFIXES.CONVERSATION}${sessionId}`;
    return this.get<CachedConversation>(cacheKey);
  }

  // Batch operations
  public async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const values = await this.client.mget(...keys);
      return values.map(value => {
        if (value) {
          this.metrics.hits++;
          return JSON.parse(value);
        }
        this.metrics.misses++;
        return null;
      });
    } catch (error) {
      console.error('Cache mget error:', error);
      return keys.map(() => null);
    }
  }

  public async mset(keyValuePairs: Record<string, any>, ttl: number = TTL.DEFAULT): Promise<boolean> {
    try {
      const pipeline = this.client.pipeline();
      
      Object.entries(keyValuePairs).forEach(([key, value]) => {
        pipeline.setex(key, ttl, JSON.stringify(value));
      });

      const results = await pipeline.exec();
      const success = results?.every(([error, result]) => !error && result === 'OK') ?? false;
      
      if (success) {
        this.metrics.sets += Object.keys(keyValuePairs).length;
      }
      
      return success;
    } catch (error) {
      console.error('Cache mset error:', error);
      return false;
    }
  }

  // Pattern-based operations
  public async invalidateByPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) return 0;
      
      const result = await this.client.del(...keys);
      this.metrics.deletes += result;
      return result;
    } catch (error) {
      console.error('Cache invalidate by pattern error:', error);
      return 0;
    }
  }

  public async getKeysByPattern(pattern: string): Promise<string[]> {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      console.error('Get keys by pattern error:', error);
      return [];
    }
  }

  // Cache invalidation methods
  public async invalidateApiResponseCache(): Promise<number> {
    return this.invalidateByPattern(`${CACHE_PREFIXES.API_RESPONSE}*`);
  }

  public async invalidateEmbeddingCache(): Promise<number> {
    return this.invalidateByPattern(`${CACHE_PREFIXES.EMBEDDING}*`);
  }

  public async invalidateConversationCache(sessionId?: string): Promise<number> {
    const pattern = sessionId 
      ? `${CACHE_PREFIXES.CONVERSATION}${sessionId}`
      : `${CACHE_PREFIXES.CONVERSATION}*`;
    return this.invalidateByPattern(pattern);
  }

  public async invalidateAllCache(): Promise<void> {
    try {
      await this.client.flushdb();
      this.resetMetrics();
    } catch (error) {
      console.error('Flush cache error:', error);
    }
  }

  // Metrics and monitoring
  public getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  public resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      lastReset: Date.now(),
    };
  }

  public getHitRatio(): number {
    const total = this.metrics.hits + this.metrics.misses;
    return total > 0 ? this.metrics.hits / total : 0;
  }

  public isHealthy(): boolean {
    return this.isConnected;
  }

  public async getConnectionInfo(): Promise<any> {
    try {
      return await this.client.client('INFO');
    } catch (error) {
      console.error('Get connection info error:', error);
      return null;
    }
  }

  public async getMemoryUsage(): Promise<any> {
    try {
      return await this.client.memory('STATS');
    } catch (error) {
      console.error('Get memory usage error:', error);
      return null;
    }
  }
}

// Export singleton instance
export const redisClient = RedisClient.getInstance();

// Export types and constants
export { RedisClient };
export default redisClient;