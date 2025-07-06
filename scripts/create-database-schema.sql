-- Create simplified portfolio content table (without vector embeddings)
CREATE TABLE IF NOT EXISTS portfolio_content_simple (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  keywords TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chat history table
CREATE TABLE IF NOT EXISTS chat_history (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) DEFAULT 'anonymous',
  user_message TEXT NOT NULL,
  bot_response TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for keyword search
CREATE INDEX IF NOT EXISTS portfolio_content_keywords_idx 
ON portfolio_content_simple USING gin(to_tsvector('english', keywords));

-- Create function to initialize tables (called from API)
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
