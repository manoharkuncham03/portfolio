-- Enable pgvector extension for vector operations
CREATE EXTENSION IF NOT EXISTS vector;

-- Create vector embedding table for storing OpenAI embeddings
CREATE TABLE IF NOT EXISTS vector_embeddings (
  id SERIAL PRIMARY KEY,
  content_id INTEGER,
  content_type VARCHAR(50) NOT NULL,
  content_text TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create advanced portfolio content table with vector column for semantic search
CREATE TABLE IF NOT EXISTS portfolio_content (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255),
  content TEXT NOT NULL,
  summary TEXT,
  embedding vector(1536),
  metadata JSONB,
  keywords TEXT,
  tags TEXT[],
  status VARCHAR(20) DEFAULT 'active',
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create response cache table for storing frequently accessed API responses
CREATE TABLE IF NOT EXISTS response_cache (
  id SERIAL PRIMARY KEY,
  cache_key VARCHAR(255) UNIQUE NOT NULL,
  response_data JSONB NOT NULL,
  metadata JSONB,
  ttl INTEGER DEFAULT 300,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '5 minutes'
);

-- Create conversation context table for chat history with embeddings
CREATE TABLE IF NOT EXISTS conversation_context (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) DEFAULT 'anonymous',
  user_message TEXT NOT NULL,
  user_message_embedding vector(1536),
  bot_response TEXT NOT NULL,
  bot_response_embedding vector(1536),
  context_metadata JSONB,
  conversation_turn INTEGER DEFAULT 1,
  response_time_ms INTEGER,
  model_used VARCHAR(100),
  tokens_used INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create performance monitoring table for tracking response times and cache metrics
CREATE TABLE IF NOT EXISTS performance_metrics (
  id SERIAL PRIMARY KEY,
  metric_type VARCHAR(50) NOT NULL,
  metric_name VARCHAR(100) NOT NULL,
  metric_value NUMERIC NOT NULL,
  metadata JSONB,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create cache performance tracking table
CREATE TABLE IF NOT EXISTS cache_metrics (
  id SERIAL PRIMARY KEY,
  cache_type VARCHAR(50) NOT NULL,
  operation VARCHAR(20) NOT NULL, -- hit, miss, set, delete
  cache_key_hash VARCHAR(64),
  execution_time_ms INTEGER,
  data_size_bytes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create simplified portfolio content table (without vector embeddings) for backward compatibility
CREATE TABLE IF NOT EXISTS portfolio_content_simple (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  keywords TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chat history table for backward compatibility
CREATE TABLE IF NOT EXISTS chat_history (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) DEFAULT 'anonymous',
  user_message TEXT NOT NULL,
  bot_response TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indices for vector similarity search using cosine distance
CREATE INDEX IF NOT EXISTS vector_embeddings_embedding_idx 
ON vector_embeddings USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS portfolio_content_embedding_idx 
ON portfolio_content USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS conversation_user_message_embedding_idx 
ON conversation_context USING ivfflat (user_message_embedding vector_cosine_ops) 
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS conversation_bot_response_embedding_idx 
ON conversation_context USING ivfflat (bot_response_embedding vector_cosine_ops) 
WITH (lists = 100);

-- Create additional performance indices
CREATE INDEX IF NOT EXISTS vector_embeddings_content_type_idx ON vector_embeddings(content_type);
CREATE INDEX IF NOT EXISTS vector_embeddings_created_at_idx ON vector_embeddings(created_at);
CREATE INDEX IF NOT EXISTS portfolio_content_type_idx ON portfolio_content(type);
CREATE INDEX IF NOT EXISTS portfolio_content_status_idx ON portfolio_content(status);
CREATE INDEX IF NOT EXISTS portfolio_content_priority_idx ON portfolio_content(priority DESC);
CREATE INDEX IF NOT EXISTS response_cache_expires_at_idx ON response_cache(expires_at);
CREATE INDEX IF NOT EXISTS conversation_session_id_idx ON conversation_context(session_id);
CREATE INDEX IF NOT EXISTS conversation_created_at_idx ON conversation_context(created_at);
CREATE INDEX IF NOT EXISTS performance_metrics_type_name_idx ON performance_metrics(metric_type, metric_name);
CREATE INDEX IF NOT EXISTS performance_metrics_recorded_at_idx ON performance_metrics(recorded_at);
CREATE INDEX IF NOT EXISTS cache_metrics_type_operation_idx ON cache_metrics(cache_type, operation);
CREATE INDEX IF NOT EXISTS cache_metrics_created_at_idx ON cache_metrics(created_at);

-- Create index for keyword search on simple table
CREATE INDEX IF NOT EXISTS portfolio_content_keywords_idx 
ON portfolio_content_simple USING gin(to_tsvector('english', keywords));

-- Create full-text search indices
CREATE INDEX IF NOT EXISTS portfolio_content_fulltext_idx 
ON portfolio_content USING gin(to_tsvector('english', title || ' ' || content || ' ' || COALESCE(keywords, '')));

-- Database functions for vector similarity search and content retrieval

-- Function to find similar content using vector embeddings
CREATE OR REPLACE FUNCTION find_similar_content(
  query_embedding vector(1536),
  content_type_filter VARCHAR(50) DEFAULT NULL,
  similarity_threshold REAL DEFAULT 0.7,
  max_results INTEGER DEFAULT 10
)
RETURNS TABLE(
  id INTEGER,
  type VARCHAR(50),
  title VARCHAR(255),
  content TEXT,
  similarity REAL,
  metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pc.id,
    pc.type,
    pc.title,
    pc.content,
    (1 - (pc.embedding <=> query_embedding)) AS similarity,
    pc.metadata
  FROM portfolio_content pc
  WHERE 
    pc.embedding IS NOT NULL
    AND (content_type_filter IS NULL OR pc.type = content_type_filter)
    AND pc.status = 'active'
    AND (1 - (pc.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY pc.embedding <=> query_embedding
  LIMIT max_results;
END;
$$;

-- Function to find similar conversations for context
CREATE OR REPLACE FUNCTION find_similar_conversations(
  query_embedding vector(1536),
  session_id_filter VARCHAR(255) DEFAULT NULL,
  similarity_threshold REAL DEFAULT 0.7,
  max_results INTEGER DEFAULT 5
)
RETURNS TABLE(
  id INTEGER,
  session_id VARCHAR(255),
  user_message TEXT,
  bot_response TEXT,
  similarity REAL,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cc.id,
    cc.session_id,
    cc.user_message,
    cc.bot_response,
    (1 - (cc.user_message_embedding <=> query_embedding)) AS similarity,
    cc.created_at
  FROM conversation_context cc
  WHERE 
    cc.user_message_embedding IS NOT NULL
    AND (session_id_filter IS NULL OR cc.session_id = session_id_filter)
    AND (1 - (cc.user_message_embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY cc.user_message_embedding <=> query_embedding
  LIMIT max_results;
END;
$$;

-- Function to get cached response
CREATE OR REPLACE FUNCTION get_cached_response(
  p_cache_key VARCHAR(255)
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT response_data INTO result
  FROM response_cache
  WHERE cache_key = p_cache_key
    AND expires_at > NOW();
  
  RETURN result;
END;
$$;

-- Function to set cached response
CREATE OR REPLACE FUNCTION set_cached_response(
  p_cache_key VARCHAR(255),
  p_response_data JSONB,
  p_ttl INTEGER DEFAULT 300
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO response_cache (cache_key, response_data, ttl, expires_at)
  VALUES (p_cache_key, p_response_data, p_ttl, NOW() + (p_ttl || ' seconds')::INTERVAL)
  ON CONFLICT (cache_key) 
  DO UPDATE SET 
    response_data = EXCLUDED.response_data,
    ttl = EXCLUDED.ttl,
    expires_at = EXCLUDED.expires_at;
END;
$$;

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM response_cache WHERE expires_at <= NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Function to record performance metrics
CREATE OR REPLACE FUNCTION record_performance_metric(
  p_metric_type VARCHAR(50),
  p_metric_name VARCHAR(100),
  p_metric_value NUMERIC,
  p_metadata JSONB DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO performance_metrics (metric_type, metric_name, metric_value, metadata)
  VALUES (p_metric_type, p_metric_name, p_metric_value, p_metadata);
END;
$$;

-- Function to record cache metrics
CREATE OR REPLACE FUNCTION record_cache_metric(
  p_cache_type VARCHAR(50),
  p_operation VARCHAR(20),
  p_cache_key_hash VARCHAR(64) DEFAULT NULL,
  p_execution_time_ms INTEGER DEFAULT NULL,
  p_data_size_bytes INTEGER DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO cache_metrics (cache_type, operation, cache_key_hash, execution_time_ms, data_size_bytes)
  VALUES (p_cache_type, p_operation, p_cache_key_hash, p_execution_time_ms, p_data_size_bytes);
END;
$$;

-- Function to get performance statistics
CREATE OR REPLACE FUNCTION get_performance_stats(
  p_metric_type VARCHAR(50) DEFAULT NULL,
  p_hours_back INTEGER DEFAULT 24
)
RETURNS TABLE(
  metric_type VARCHAR(50),
  metric_name VARCHAR(100),
  avg_value NUMERIC,
  min_value NUMERIC,
  max_value NUMERIC,
  count_samples BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pm.metric_type,
    pm.metric_name,
    AVG(pm.metric_value) as avg_value,
    MIN(pm.metric_value) as min_value,
    MAX(pm.metric_value) as max_value,
    COUNT(*) as count_samples
  FROM performance_metrics pm
  WHERE 
    (p_metric_type IS NULL OR pm.metric_type = p_metric_type)
    AND pm.recorded_at >= NOW() - (p_hours_back || ' hours')::INTERVAL
  GROUP BY pm.metric_type, pm.metric_name
  ORDER BY pm.metric_type, pm.metric_name;
END;
$$;

-- Function to initialize tables (called from API)
CREATE OR REPLACE FUNCTION create_portfolio_tables()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- This function ensures tables exist
  -- Tables are created above, this is just a placeholder for the API call
  NULL;
END;
$$;

-- Create triggers for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER vector_embeddings_updated_at
  BEFORE UPDATE ON vector_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER portfolio_content_updated_at
  BEFORE UPDATE ON portfolio_content
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();