import { Pool, PoolClient, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import { z } from 'zod';

// Configuration schema
const DatabaseConfigSchema = z.object({
  host: z.string(),
  port: z.number().default(5432),
  database: z.string(),
  user: z.string(),
  password: z.string(),
  ssl: z.boolean().default(true),
  poolMin: z.number().default(2),
  poolMax: z.number().default(20),
  idleTimeout: z.number().default(30000),
  connectionTimeout: z.number().default(20000),
  statementTimeout: z.number().default(60000),
});

// Query types
export interface QueryOptions {
  timeout?: number;
  prepared?: boolean;
  name?: string;
}

export interface TransactionCallback<T> {
  (client: PoolClient): Promise<T>;
}

export interface ConnectionMetrics {
  totalConnections: number;
  idleConnections: number;
  waitingClients: number;
  maxConnections: number;
  totalQueries: number;
  totalErrors: number;
  averageQueryTime: number;
  lastHealthCheck: number;
  isHealthy: boolean;
}

export interface PreparedStatement {
  name: string;
  text: string;
  values?: any[];
  lastUsed: number;
  usageCount: number;
}

// Health check result
export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  activeConnections: number;
  metrics: ConnectionMetrics;
  errors: string[];
}

class DatabasePool {
  private static instance: DatabasePool;
  private pool!: Pool;
  private config: z.infer<typeof DatabaseConfigSchema>;
  private metrics: ConnectionMetrics;
  private preparedStatements = new Map<string, PreparedStatement>();
  private healthCheckInterval?: NodeJS.Timeout;
  private isInitialized = false;
  private queryTimes: number[] = [];
  private maxQueryTimeHistory = 1000;

  private constructor() {
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
      statementTimeout: parseInt(process.env.DB_POOL_STATEMENT_TIMEOUT || '60000'),
    });

    this.metrics = {
      totalConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
      maxConnections: this.config.poolMax,
      totalQueries: 0,
      totalErrors: 0,
      averageQueryTime: 0,
      lastHealthCheck: 0,
      isHealthy: false,
    };

    this.initializePool();
  }

  public static getInstance(): DatabasePool {
    if (!DatabasePool.instance) {
      DatabasePool.instance = new DatabasePool();
    }
    return DatabasePool.instance;
  }

  private initializePool(): void {
    const poolConfig: PoolConfig = {
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
      statement_timeout: this.config.statementTimeout,
      application_name: 'portfolio-chatbot',
    };

    this.pool = new Pool(poolConfig);
    this.setupEventHandlers();
    this.startHealthChecking();
    this.isInitialized = true;
  }

  private setupEventHandlers(): void {
    this.pool.on('connect', (client: PoolClient) => {
      console.log('New database client connected');
      this.metrics.totalConnections++;
      
      // Enable pgvector extension on new connections
      client.query('CREATE EXTENSION IF NOT EXISTS vector;').catch((error) => {
        console.warn('Failed to create vector extension:', error.message);
      });
    });

    this.pool.on('acquire', () => {
      this.updateConnectionMetrics();
    });

    this.pool.on('release', () => {
      this.updateConnectionMetrics();
    });

    this.pool.on('error', (error: Error) => {
      console.error('Database pool error:', error);
      this.metrics.totalErrors++;
      this.metrics.isHealthy = false;
    });

    this.pool.on('remove', () => {
      this.metrics.totalConnections--;
    });
  }

  private updateConnectionMetrics(): void {
    this.metrics.totalConnections = this.pool.totalCount;
    this.metrics.idleConnections = this.pool.idleCount;
    this.metrics.waitingClients = this.pool.waitingCount;
  }

  private startHealthChecking(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('Health check failed:', error);
        this.metrics.isHealthy = false;
      }
    }, 30000); // Check every 30 seconds
  }

  private async performHealthCheck(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const result = await this.query('SELECT 1 as health_check', [], { timeout: 5000 });
      const latency = Date.now() - startTime;
      
      this.metrics.isHealthy = result.rows.length > 0 && latency < 1000;
      this.metrics.lastHealthCheck = Date.now();
    } catch (error) {
      this.metrics.isHealthy = false;
      this.metrics.totalErrors++;
      throw error;
    }
  }

  // Core query methods
  public async query<T extends QueryResultRow = any>(
    text: string,
    params: any[] = [],
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    if (!this.isInitialized) {
      throw new Error('Database pool not initialized');
    }

    const startTime = Date.now();
    let client: PoolClient | null = null;

    try {
      client = await this.pool.connect();
      
      if (options.timeout) {
        client.query(`SET statement_timeout = ${options.timeout}`);
      }

      let result: QueryResult<T>;
      
      if (options.prepared && options.name) {
        result = await this.executePreparedStatement(client, options.name, text, params);
      } else {
        result = await client.query(text, params);
      }

      const queryTime = Date.now() - startTime;
      this.recordQueryTime(queryTime);
      this.metrics.totalQueries++;

      return result;
    } catch (error) {
      this.metrics.totalErrors++;
      console.error('Query error:', error);
      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  // Transaction management
  public async transaction<T>(callback: TransactionCallback<T>): Promise<T> {
    if (!this.isInitialized) {
      throw new Error('Database pool not initialized');
    }

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      this.metrics.totalErrors++;
      throw error;
    } finally {
      client.release();
    }
  }

  // Prepared statement management
  private async executePreparedStatement<T extends QueryResultRow = any>(
    client: PoolClient,
    name: string,
    text: string,
    params: any[]
  ): Promise<QueryResult<T>> {
    const existing = this.preparedStatements.get(name);
    
    if (!existing) {
      // Create new prepared statement
      await client.query({
        name,
        text: text,
      });
      
      this.preparedStatements.set(name, {
        name,
        text,
        lastUsed: Date.now(),
        usageCount: 1,
      });
    } else {
      // Update usage statistics
      existing.lastUsed = Date.now();
      existing.usageCount++;
    }

    return client.query({
      name,
      values: params,
    });
  }

  public async prepareBatchStatements(statements: Array<{ name: string; text: string }>): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      for (const stmt of statements) {
        if (!this.preparedStatements.has(stmt.name)) {
          await client.query({
            name: stmt.name,
            text: stmt.text,
          });
          
          this.preparedStatements.set(stmt.name, {
            name: stmt.name,
            text: stmt.text,
            lastUsed: Date.now(),
            usageCount: 0,
          });
        }
      }
    } finally {
      client.release();
    }
  }

  public clearPreparedStatements(): void {
    this.preparedStatements.clear();
  }

  public getPreparedStatementStats(): PreparedStatement[] {
    return Array.from(this.preparedStatements.values());
  }

  // Batch operations
  public async batchQuery<T extends QueryResultRow = any>(
    queries: Array<{ text: string; params?: any[] }>
  ): Promise<QueryResult<T>[]> {
    return this.transaction(async (client) => {
      const results: QueryResult<T>[] = [];
      
      for (const query of queries) {
        const result = await client.query(query.text, query.params || []);
        results.push(result);
      }
      
      return results;
    });
  }

  // Vector-specific operations
  public async insertWithVector(
    table: string,
    data: Record<string, any>,
    vectorColumn: string,
    vectorData: number[]
  ): Promise<QueryResult> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    
    // Add vector column and data
    columns.push(vectorColumn);
    values.push(`[${vectorData.join(',')}]`);
    
    const placeholders = columns.map((_, index) => 
      index === columns.length - 1 ? `$${index + 1}::vector` : `$${index + 1}`
    );
    
    const query = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;
    
    return this.query(query, values);
  }

  public async vectorSimilaritySearch(
    table: string,
    vectorColumn: string,
    queryVector: number[],
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<QueryResult> {
    const query = `
      SELECT *, 
             1 - (${vectorColumn} <=> $1::vector) as similarity
      FROM ${table}
      WHERE 1 - (${vectorColumn} <=> $1::vector) > $2
      ORDER BY ${vectorColumn} <=> $1::vector
      LIMIT $3
    `;
    
    return this.query(query, [`[${queryVector.join(',')}]`, threshold, limit]);
  }

  // Connection management
  public async closeAllConnections(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    await this.pool.end();
    this.isInitialized = false;
  }

  public async testConnection(): Promise<boolean> {
    try {
      const result = await this.query('SELECT NOW() as current_time');
      return result.rows.length > 0;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  // Health and monitoring
  public async getDetailedHealthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    
    try {
      await this.query('SELECT 1');
      const latency = Date.now() - startTime;
      
      // Check pgvector extension
      try {
        await this.query("SELECT 1 FROM pg_extension WHERE extname = 'vector'");
      } catch (error) {
        errors.push('pgvector extension not available');
      }
      
      this.updateConnectionMetrics();
      
      const status = errors.length === 0 && latency < 1000 && this.metrics.isHealthy
        ? 'healthy'
        : errors.length > 0 || latency > 2000
          ? 'unhealthy'
          : 'degraded';
      
      return {
        status,
        latency,
        activeConnections: this.pool.totalCount - this.pool.idleCount,
        metrics: { ...this.metrics },
        errors,
      };
    } catch (error) {
      errors.push(String(error));
      return {
        status: 'unhealthy',
        latency: Date.now() - startTime,
        activeConnections: 0,
        metrics: { ...this.metrics },
        errors,
      };
    }
  }

  public getMetrics(): ConnectionMetrics {
    this.updateConnectionMetrics();
    return { ...this.metrics };
  }

  private recordQueryTime(time: number): void {
    this.queryTimes.push(time);
    
    if (this.queryTimes.length > this.maxQueryTimeHistory) {
      this.queryTimes.shift();
    }
    
    this.metrics.averageQueryTime = this.queryTimes.reduce((a, b) => a + b, 0) / this.queryTimes.length;
  }

  // Cleanup and maintenance
  public async cleanupPreparedStatements(maxAge: number = 3600000): Promise<number> {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [name, stmt] of this.preparedStatements.entries()) {
      if (now - stmt.lastUsed > maxAge) {
        this.preparedStatements.delete(name);
        cleaned++;
      }
    }
    
    return cleaned;
  }

  public async vacuum(table?: string): Promise<void> {
    const query = table ? `VACUUM ANALYZE ${table}` : 'VACUUM ANALYZE';
    await this.query(query);
  }

  public async getTableStats(table: string): Promise<any> {
    const query = `
      SELECT 
        schemaname,
        tablename,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes,
        n_live_tup as live_tuples,
        n_dead_tup as dead_tuples,
        last_vacuum,
        last_autovacuum,
        last_analyze,
        last_autoanalyze
      FROM pg_stat_user_tables 
      WHERE tablename = $1
    `;
    
    const result = await this.query(query, [table]);
    return result.rows[0] || null;
  }
}

// Export singleton instance and class
export const databasePool = DatabasePool.getInstance();
export { DatabasePool };
export default databasePool;