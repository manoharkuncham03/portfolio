import { Pool, PoolClient, QueryResult } from 'pg';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Configuration schemas
const DatabaseConfigSchema = z.object({
  host: z.string().optional(),
  port: z.number().default(5432),
  database: z.string().optional(),
  user: z.string().optional(),
  password: z.string().optional(),
  ssl: z.boolean().default(true),
  poolMin: z.number().default(2),
  poolMax: z.number().default(20),
  idleTimeout: z.number().default(30000),
  connectionTimeout: z.number().default(20000),
});

// Cache interface
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// Database manager class with connection pooling
export class DatabaseManager {
  private static instance: DatabaseManager;
  private pool: Pool | null = null;
  private supabase: SupabaseClient;
  private cache = new Map<string, CacheEntry<any>>();
  private config: z.infer<typeof DatabaseConfigSchema>;
  private isInitialized = false;
  private tableExistenceCache = new Map<string, boolean>();

  private constructor() {
    // Initialize Supabase client
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    this.config = DatabaseConfigSchema.parse({
      host: process.env.POSTGRES_HOST,
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DATABASE,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      ssl: process.env.NODE_ENV === 'production',
      poolMin: parseInt(process.env.DB_POOL_MIN || '2'),
      poolMax: parseInt(process.env.DB_POOL_MAX || '20'),
      idleTimeout: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000'),
      connectionTimeout: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '20000'),
    });

    this.initializePool();
  }

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  private initializePool(): void {
    try {
      // Only initialize PostgreSQL pool if we have the required config
      if (this.config.host && this.config.database && this.config.user && this.config.password) {
        this.pool = new Pool({
          host: this.config.host,
          port: this.config.port,
          database: this.config.database,
          user: this.config.user,
          password: this.config.password,
          ssl: this.config.ssl ? { rejectUnauthorized: false } : false,
          min: this.config.poolMin,
          max: this.config.poolMax,
          idleTimeoutMillis: this.config.idleTimeout,
          connectionTimeoutMillis: this.config.connectionTimeout,
          application_name: 'portfolio-chatbot',
        });

        this.pool.on('error', (err) => {
          console.error('PostgreSQL pool error:', err);
        });

        this.pool.on('connect', () => {
          console.log('New PostgreSQL client connected');
        });
      }

      this.isInitialized = true;
      console.log('Database manager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database pool:', error);
      this.isInitialized = false;
    }
  }

  // Cache management
  private getCacheKey(operation: string, params: any[]): string {
    return `${operation}:${JSON.stringify(params)}`;
  }

  private setCache<T>(key: string, data: T, ttlMs: number = 300000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    });
  }

  private getCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private clearCache(pattern?: string): void {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  // Table existence checking
  public async checkTableExists(tableName: string): Promise<boolean> {
    const cacheKey = `table_exists:${tableName}`;
    
    // Check cache first
    if (this.tableExistenceCache.has(tableName)) {
      return this.tableExistenceCache.get(tableName)!;
    }

    try {
      const { data, error } = await this.supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_name', tableName)
        .eq('table_schema', 'public')
        .single();

      const exists = !error && !!data;
      this.tableExistenceCache.set(tableName, exists);
      
      console.log(`Table ${tableName} exists: ${exists}`);
      return exists;
    } catch (error) {
      console.error(`Error checking table existence for ${tableName}:`, error);
      return false;
    }
  }

  // Safe table creation with existence check
  public async createTableIfNotExists(tableName: string, createQuery: string): Promise<boolean> {
    try {
      const exists = await this.checkTableExists(tableName);
      
      if (exists) {
        console.log(`Table ${tableName} already exists, skipping creation`);
        return true;
      }

      console.log(`Creating table ${tableName}...`);
      const { error } = await this.supabase.rpc('exec_sql', { sql: createQuery });
      
      if (error) {
        // Check if error is due to table already existing
        if (error.message?.includes('already exists')) {
          console.log(`Table ${tableName} was created by another process`);
          this.tableExistenceCache.set(tableName, true);
          return true;
        }
        throw error;
      }

      this.tableExistenceCache.set(tableName, true);
      console.log(`Table ${tableName} created successfully`);
      return true;
    } catch (error) {
      console.error(`Error creating table ${tableName}:`, error);
      return false;
    }
  }

  // Initialize all required tables
  public async initializeTables(): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      // Check if the main tables exist first
      const requiredTables = [
        'user_sessions',
        'conversation_context', 
        'portfolio_content',
        'response_cache'
      ];

      const tableChecks = await Promise.all(
        requiredTables.map(async (table) => ({
          table,
          exists: await this.checkTableExists(table)
        }))
      );

      const missingTables = tableChecks.filter(check => !check.exists);
      
      if (missingTables.length === 0) {
        console.log('All required tables already exist');
        return { success: true, errors: [] };
      }

      console.log(`Missing tables: ${missingTables.map(t => t.table).join(', ')}`);

      // Call the database function to create tables
      const { error } = await this.supabase.rpc('create_portfolio_tables');
      
      if (error) {
        console.error('Error initializing tables:', error);
        errors.push(`Table initialization failed: ${error.message}`);
        return { success: false, errors };
      }

      // Clear table existence cache to force re-check
      this.tableExistenceCache.clear();
      
      // Verify tables were created
      const verificationChecks = await Promise.all(
        requiredTables.map(async (table) => ({
          table,
          exists: await this.checkTableExists(table)
        }))
      );

      const stillMissing = verificationChecks.filter(check => !check.exists);
      
      if (stillMissing.length > 0) {
        const missingTableNames = stillMissing.map(t => t.table).join(', ');
        errors.push(`Tables still missing after creation: ${missingTableNames}`);
        return { success: false, errors };
      }

      console.log('All tables initialized successfully');
      return { success: true, errors: [] };
    } catch (error) {
      console.error('Error during table initialization:', error);
      errors.push(`Initialization error: ${error}`);
      return { success: false, errors };
    }
  }

  // Optimized query execution with caching
  public async executeQuery<T = any>(
    query: string,
    params: any[] = [],
    options: {
      cache?: boolean;
      cacheTtl?: number;
      tableName?: string;
    } = {}
  ): Promise<QueryResult<T> | null> {
    const { cache = false, cacheTtl = 300000, tableName } = options;
    
    try {
      // Check cache if enabled
      if (cache) {
        const cacheKey = this.getCacheKey(query, params);
        const cached = this.getCache<QueryResult<T>>(cacheKey);
        if (cached) {
          console.log('Query result served from cache');
          return cached;
        }
      }

      let result: QueryResult<T>;

      // Use PostgreSQL pool if available, otherwise fall back to Supabase
      if (this.pool) {
        const client = await this.pool.connect();
        try {
          result = await client.query(query, params);
        } finally {
          client.release();
        }
      } else {
        // Use Supabase RPC for raw SQL execution
        const { data, error } = await this.supabase.rpc('exec_sql', {
          sql: query,
          params: params
        });
        
        if (error) throw error;
        
        result = { rows: data || [], rowCount: data?.length || 0 } as QueryResult<T>;
      }

      // Cache result if enabled
      if (cache) {
        const cacheKey = this.getCacheKey(query, params);
        this.setCache(cacheKey, result, cacheTtl);
      }

      return result;
    } catch (error) {
      console.error('Query execution error:', error);
      console.error('Query:', query);
      console.error('Params:', params);
      return null;
    }
  }

  // Optimized portfolio content operations
  public async getPortfolioContent(
    type?: string,
    useCache: boolean = true
  ): Promise<any[]> {
    try {
      const cacheKey = `portfolio_content:${type || 'all'}`;
      
      if (useCache) {
        const cached = this.getCache<any[]>(cacheKey);
        if (cached) return cached;
      }

      let query = this.supabase
        .from('portfolio_content')
        .select('*')
        .eq('status', 'active')
        .order('priority', { ascending: false });

      if (type) {
        query = query.eq('content_type', type);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching portfolio content:', error);
        return [];
      }

      const result = data || [];
      
      if (useCache) {
        this.setCache(cacheKey, result, 600000); // 10 minutes cache
      }

      return result;
    } catch (error) {
      console.error('Error in getPortfolioContent:', error);
      return [];
    }
  }

  // Optimized conversation storage
  public async storeConversation(
    sessionId: string,
    userMessage: string,
    botResponse: string,
    metadata: any = {}
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('conversation_context')
        .insert({
          session_id: sessionId,
          user_message: userMessage,
          bot_response: botResponse,
          context_metadata: metadata,
          response_time_ms: metadata.responseTime || null,
          model_used: metadata.model || null,
          tokens_used: metadata.tokens || null,
        });

      if (error) {
        console.error('Error storing conversation:', error);
        return false;
      }

      // Clear related cache
      this.clearCache(`conversation:${sessionId}`);
      
      return true;
    } catch (error) {
      console.error('Error in storeConversation:', error);
      return false;
    }
  }

  // Optimized session management
  public async initializeSession(
    sessionId: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('user_sessions')
        .upsert({
          session_id: sessionId,
          user_agent: userAgent,
          ip_address: ipAddress,
          last_activity: new Date().toISOString(),
          is_active: true,
        }, {
          onConflict: 'session_id'
        });

      if (error) {
        console.error('Error initializing session:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in initializeSession:', error);
      return false;
    }
  }

  // Health check
  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  }> {
    const details: Record<string, any> = {};
    
    try {
      // Test Supabase connection
      const { data, error } = await this.supabase
        .from('user_sessions')
        .select('count')
        .limit(1);
      
      details.supabase = {
        status: error ? 'unhealthy' : 'healthy',
        error: error?.message
      };

      // Test PostgreSQL pool if available
      if (this.pool) {
        try {
          const client = await this.pool.connect();
          await client.query('SELECT 1');
          client.release();
          details.postgresql = { status: 'healthy' };
        } catch (error) {
          details.postgresql = { 
            status: 'unhealthy', 
            error: String(error) 
          };
        }
      }

      // Check cache performance
      details.cache = {
        size: this.cache.size,
        tableCache: this.tableExistenceCache.size
      };

      // Determine overall status
      const hasUnhealthy = Object.values(details).some(
        (detail: any) => detail.status === 'unhealthy'
      );
      
      const status = hasUnhealthy ? 'unhealthy' : 'healthy';

      return { status, details };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: String(error) }
      };
    }
  }

  // Cleanup and connection management
  public async cleanup(): Promise<void> {
    try {
      this.cache.clear();
      this.tableExistenceCache.clear();
      
      if (this.pool) {
        await this.pool.end();
        console.log('PostgreSQL pool closed');
      }
      
      console.log('Database manager cleanup completed');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  // Get connection statistics
  public getConnectionStats(): Record<string, any> {
    const stats: Record<string, any> = {
      isInitialized: this.isInitialized,
      cacheSize: this.cache.size,
      tableCacheSize: this.tableExistenceCache.size,
    };

    if (this.pool) {
      stats.postgresql = {
        totalCount: this.pool.totalCount,
        idleCount: this.pool.idleCount,
        waitingCount: this.pool.waitingCount,
      };
    }

    return stats;
  }
}

// Export singleton instance
export const databaseManager = DatabaseManager.getInstance();

// Utility functions
export async function initializeDatabase(): Promise<{ success: boolean; errors: string[] }> {
  return databaseManager.initializeTables();
}

export async function checkDatabaseHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  details: Record<string, any>;
}> {
  return databaseManager.healthCheck();
}

export async function cleanupDatabase(): Promise<void> {
  return databaseManager.cleanup();
}