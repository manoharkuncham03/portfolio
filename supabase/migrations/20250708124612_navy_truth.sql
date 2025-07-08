-- Enhanced Database Schema for Portfolio Chatbot
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS conversation_analytics CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS content_analytics CASCADE;
DROP TABLE IF EXISTS search_queries CASCADE;
DROP TABLE IF EXISTS feedback_ratings CASCADE;

-- Enhanced user sessions table with better tracking
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) UNIQUE NOT NULL,
  user_agent TEXT,
  ip_address INET,
  country VARCHAR(100),
  city VARCHAR(100),
  device_type VARCHAR(50),
  browser VARCHAR(100),
  referrer TEXT,
  first_visit TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_messages INTEGER DEFAULT 0,
  session_duration INTEGER DEFAULT 0, -- in seconds
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enhanced conversation context with better structure
DROP TABLE IF EXISTS conversation_context CASCADE;
CREATE TABLE conversation_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL REFERENCES user_sessions(session_id) ON DELETE CASCADE,
  conversation_id UUID DEFAULT gen_random_uuid(),
  message_index INTEGER NOT NULL,
  user_message TEXT NOT NULL,
  user_message_embedding vector(1536),
  bot_response TEXT NOT NULL,
  bot_response_embedding vector(1536),
  intent_detected VARCHAR(100),
  confidence_score REAL,
  response_time_ms INTEGER,
  model_used VARCHAR(100),
  tokens_used INTEGER,
  context_used TEXT[], -- Array of context sources used
  feedback_rating INTEGER CHECK (feedback_rating >= 1 AND feedback_rating <= 5),
  feedback_comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced portfolio content with better categorization
DROP TABLE IF EXISTS portfolio_content CASCADE;
CREATE TABLE portfolio_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type VARCHAR(50) NOT NULL,
  category VARCHAR(100),
  title VARCHAR(500),
  content TEXT NOT NULL,
  summary TEXT,
  embedding vector(1536),
  keywords TEXT[],
  tags TEXT[],
  priority INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'draft')),
  language VARCHAR(10) DEFAULT 'en',
  view_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Search queries tracking for analytics
CREATE TABLE search_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) REFERENCES user_sessions(session_id) ON DELETE CASCADE,
  query_text TEXT NOT NULL,
  query_embedding vector(1536),
  intent_detected VARCHAR(100),
  results_count INTEGER DEFAULT 0,
  response_time_ms INTEGER,
  user_clicked BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content analytics for tracking popular content
CREATE TABLE content_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID REFERENCES portfolio_content(id) ON DELETE CASCADE,
  session_id VARCHAR(255) REFERENCES user_sessions(session_id) ON DELETE CASCADE,
  access_type VARCHAR(50), -- 'search', 'direct', 'related'
  relevance_score REAL,
  time_spent INTEGER, -- seconds
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversation analytics for insights
CREATE TABLE conversation_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) REFERENCES user_sessions(session_id) ON DELETE CASCADE,
  conversation_id UUID,
  total_messages INTEGER DEFAULT 0,
  avg_response_time REAL,
  user_satisfaction REAL, -- calculated from feedback
  topics_discussed TEXT[],
  intents_detected TEXT[],
  conversation_duration INTEGER, -- seconds
  ended_reason VARCHAR(100), -- 'user_left', 'timeout', 'completed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Feedback and ratings
CREATE TABLE feedback_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) REFERENCES user_sessions(session_id) ON DELETE CASCADE,
  conversation_id UUID,
  message_id UUID REFERENCES conversation_context(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback_type VARCHAR(50), -- 'helpful', 'accurate', 'relevant', 'overall'
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced response cache with better TTL management
DROP TABLE IF EXISTS response_cache CASCADE;
CREATE TABLE response_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key VARCHAR(500) UNIQUE NOT NULL,
  cache_type VARCHAR(100) NOT NULL,
  response_data JSONB NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  hit_count INTEGER DEFAULT 0,
  ttl_seconds INTEGER DEFAULT 300,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '5 minutes',
  last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create optimized indices for better performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_sessions_last_activity ON user_sessions(last_activity);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_sessions_is_active ON user_sessions(is_active) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversation_session_id ON conversation_context(session_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversation_created_at ON conversation_context(created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversation_intent ON conversation_context(intent_detected);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portfolio_content_type ON portfolio_content(content_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portfolio_content_status ON portfolio_content(status) WHERE status = 'active';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portfolio_content_priority ON portfolio_content(priority DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portfolio_content_keywords ON portfolio_content USING gin(keywords);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portfolio_content_tags ON portfolio_content USING gin(tags);

-- Vector similarity search indices
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversation_user_embedding 
ON conversation_context USING ivfflat (user_message_embedding vector_cosine_ops) 
WITH (lists = 100);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portfolio_embedding 
ON portfolio_content USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_queries_embedding 
ON search_queries USING ivfflat (query_embedding vector_cosine_ops) 
WITH (lists = 100);

-- Full-text search indices
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portfolio_fulltext 
ON portfolio_content USING gin(to_tsvector('english', 
  COALESCE(title, '') || ' ' || content || ' ' || array_to_string(keywords, ' ')
));

-- Cache indices
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_response_cache_expires_at ON response_cache(expires_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_response_cache_type ON response_cache(cache_type);

-- Enhanced functions for better search and analytics

-- Function to find similar content with enhanced scoring
CREATE OR REPLACE FUNCTION find_similar_content_enhanced(
  query_embedding vector(1536),
  content_type_filter VARCHAR(50) DEFAULT NULL,
  category_filter VARCHAR(100) DEFAULT NULL,
  similarity_threshold REAL DEFAULT 0.7,
  max_results INTEGER DEFAULT 10,
  boost_popular BOOLEAN DEFAULT true
)
RETURNS TABLE(
  id UUID,
  content_type VARCHAR(50),
  category VARCHAR(100),
  title VARCHAR(500),
  content TEXT,
  similarity REAL,
  popularity_score REAL,
  final_score REAL,
  metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH similarity_scores AS (
    SELECT 
      pc.id,
      pc.content_type,
      pc.category,
      pc.title,
      pc.content,
      (1 - (pc.embedding <=> query_embedding)) AS similarity,
      COALESCE(pc.view_count::REAL / NULLIF((SELECT MAX(view_count) FROM portfolio_content), 0), 0) AS popularity_score,
      pc.metadata
    FROM portfolio_content pc
    WHERE 
      pc.embedding IS NOT NULL
      AND pc.status = 'active'
      AND (content_type_filter IS NULL OR pc.content_type = content_type_filter)
      AND (category_filter IS NULL OR pc.category = category_filter)
      AND (1 - (pc.embedding <=> query_embedding)) >= similarity_threshold
  )
  SELECT 
    ss.id,
    ss.content_type,
    ss.category,
    ss.title,
    ss.content,
    ss.similarity,
    ss.popularity_score,
    CASE 
      WHEN boost_popular THEN (ss.similarity * 0.8 + ss.popularity_score * 0.2)
      ELSE ss.similarity
    END AS final_score,
    ss.metadata
  FROM similarity_scores ss
  ORDER BY final_score DESC
  LIMIT max_results;
END;
$$;

-- Function to track user interaction
CREATE OR REPLACE FUNCTION track_user_interaction(
  p_session_id VARCHAR(255),
  p_interaction_type VARCHAR(100),
  p_content_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update session activity
  UPDATE user_sessions 
  SET 
    last_activity = NOW(),
    total_messages = total_messages + 1
  WHERE session_id = p_session_id;
  
  -- Track content access if content_id provided
  IF p_content_id IS NOT NULL THEN
    INSERT INTO content_analytics (content_id, session_id, access_type, created_at)
    VALUES (p_content_id, p_session_id, p_interaction_type, NOW());
    
    -- Update content view count
    UPDATE portfolio_content 
    SET 
      view_count = view_count + 1,
      last_accessed = NOW()
    WHERE id = p_content_id;
  END IF;
END;
$$;

-- Function to get conversation analytics
CREATE OR REPLACE FUNCTION get_conversation_analytics(
  days_back INTEGER DEFAULT 7
)
RETURNS TABLE(
  total_sessions BIGINT,
  total_messages BIGINT,
  avg_session_duration REAL,
  avg_messages_per_session REAL,
  top_intents TEXT[],
  popular_content TEXT[]
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH session_stats AS (
    SELECT 
      COUNT(DISTINCT us.session_id) as total_sessions,
      COUNT(cc.id) as total_messages,
      AVG(us.session_duration) as avg_duration,
      AVG(us.total_messages::REAL) as avg_messages
    FROM user_sessions us
    LEFT JOIN conversation_context cc ON us.session_id = cc.session_id
    WHERE us.first_visit >= NOW() - (days_back || ' days')::INTERVAL
  ),
  intent_stats AS (
    SELECT array_agg(intent_detected ORDER BY intent_count DESC) as top_intents
    FROM (
      SELECT intent_detected, COUNT(*) as intent_count
      FROM conversation_context
      WHERE created_at >= NOW() - (days_back || ' days')::INTERVAL
        AND intent_detected IS NOT NULL
      GROUP BY intent_detected
      ORDER BY intent_count DESC
      LIMIT 5
    ) t
  ),
  content_stats AS (
    SELECT array_agg(title ORDER BY access_count DESC) as popular_content
    FROM (
      SELECT pc.title, COUNT(ca.id) as access_count
      FROM portfolio_content pc
      JOIN content_analytics ca ON pc.id = ca.content_id
      WHERE ca.created_at >= NOW() - (days_back || ' days')::INTERVAL
      GROUP BY pc.id, pc.title
      ORDER BY access_count DESC
      LIMIT 5
    ) t
  )
  SELECT 
    ss.total_sessions,
    ss.total_messages,
    ss.avg_duration,
    ss.avg_messages,
    COALESCE(ist.top_intents, ARRAY[]::TEXT[]),
    COALESCE(cs.popular_content, ARRAY[]::TEXT[])
  FROM session_stats ss
  CROSS JOIN intent_stats ist
  CROSS JOIN content_stats cs;
END;
$$;

-- Function to clean old data
CREATE OR REPLACE FUNCTION cleanup_old_data(
  days_to_keep INTEGER DEFAULT 30
)
RETURNS TABLE(
  deleted_sessions INTEGER,
  deleted_cache_entries INTEGER,
  deleted_analytics INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  del_sessions INTEGER;
  del_cache INTEGER;
  del_analytics INTEGER;
BEGIN
  -- Delete old inactive sessions and related data
  DELETE FROM user_sessions 
  WHERE last_activity < NOW() - (days_to_keep || ' days')::INTERVAL
    AND is_active = false;
  GET DIAGNOSTICS del_sessions = ROW_COUNT;
  
  -- Delete expired cache entries
  DELETE FROM response_cache 
  WHERE expires_at < NOW();
  GET DIAGNOSTICS del_cache = ROW_COUNT;
  
  -- Delete old analytics data (keep longer for insights)
  DELETE FROM content_analytics 
  WHERE created_at < NOW() - ((days_to_keep * 2) || ' days')::INTERVAL;
  GET DIAGNOSTICS del_analytics = ROW_COUNT;
  
  RETURN QUERY SELECT del_sessions, del_cache, del_analytics;
END;
$$;

-- Insert sample portfolio content
INSERT INTO portfolio_content (content_type, category, title, content, keywords, tags, priority) VALUES
('personal', 'bio', 'About Manohar Kumar', 
 'I am Manohar Kumar, a passionate AI Developer and Frontend Developer with experience at Consuy. I specialize in building intelligent applications using modern technologies like React, Python, and AI/ML frameworks.',
 ARRAY['manohar kumar', 'ai developer', 'frontend developer', 'about', 'bio', 'profile'],
 ARRAY['personal', 'introduction', 'bio'],
 10),

('experience', 'work', 'AI Developer Intern at Consuy',
 'Currently working as an AI Developer Intern at Consuy (March 2025 – Present). I engineer and orchestrate multi-agent systems using CrewAI and Azure OpenAI services, reducing ticket creation time significantly. I implement intelligent ticket assignment functionality and boost AI agent effectiveness through fine-tuning.',
 ARRAY['consuy', 'ai developer', 'intern', 'crewai', 'azure openai', 'multi-agent systems'],
 ARRAY['experience', 'work', 'ai', 'current'],
 9),

('experience', 'work', 'Frontend Developer Intern at Consuy',
 'Previously worked as Frontend Developer Intern at Consuy (July 2024 – March 2025). I engineered production-ready frontend applications using React and TypeScript, integrated RESTful APIs with Python and FastAPI, and optimized frontend performance using lazy loading and memoization techniques.',
 ARRAY['consuy', 'frontend developer', 'react', 'typescript', 'fastapi', 'performance optimization'],
 ARRAY['experience', 'work', 'frontend', 'previous'],
 8),

('project', 'ai', 'PrepBot - AI Interview Preparation Tool',
 'Developed PrepBot, a high-performance React + TypeScript frontend with WebRTC webcam capture, TARVUS-driven avatar, and live transcription overlays achieving sub-200ms conversational latency. Built modular backend using Python FastAPI with TARVUS avatar generation and ElevenLabs TTS pipelines. Implemented AI feedback suite with OpenAI GPT-4 for semantic answer scoring.',
 ARRAY['prepbot', 'ai', 'interview', 'react', 'typescript', 'webrtc', 'tarvus', 'openai', 'gpt-4'],
 ARRAY['project', 'ai', 'interview', 'featured'],
 9),

('project', 'tools', 'Code Pulse - Code Analysis Tool',
 'Developed a comprehensive code analysis tool that performs critical assessments across multiple programming languages. Achieved 65% reduction in manual code review time by automating code quality checks for large-scale projects, enabling teams to focus on critical issues faster.',
 ARRAY['code pulse', 'code analysis', 'python', 'streamlit', 'code quality', 'automation'],
 ARRAY['project', 'tools', 'analysis'],
 7),

('project', 'ai', 'Smart Video Surveillance System',
 'Engineered a video surveillance system capable of handling up to 10 concurrent video streams at 30 FPS with 89% accuracy rate for face recognition. Integrated YOLOv5 for efficient object detection and implemented scalable alerting system delivering 20+ real-time alerts per minute with sub-500ms latency.',
 ARRAY['surveillance', 'video', 'yolov5', 'face recognition', 'object detection', 'real-time'],
 ARRAY['project', 'ai', 'computer-vision'],
 8),

('skills', 'programming', 'Programming Languages',
 'I am proficient in Python, JavaScript, and C. Python is my primary language for AI/ML development and backend services. JavaScript for frontend development and web applications. C for system-level programming and performance-critical applications.',
 ARRAY['python', 'javascript', 'c', 'programming', 'languages', 'coding'],
 ARRAY['skills', 'programming', 'languages'],
 8),

('skills', 'web', 'Web Development Technologies',
 'Expert in HTML/CSS, Tailwind CSS, React, and NextJS. I build responsive, modern web applications with excellent user experience. Experienced in component-based architecture, state management, and performance optimization.',
 ARRAY['html', 'css', 'tailwind', 'react', 'nextjs', 'web development', 'frontend'],
 ARRAY['skills', 'web', 'frontend'],
 8),

('skills', 'ai', 'AI/ML Technologies',
 'Specialized in YOLOv5, SpaCy, OpenRouter, GenAI, Agentic AI, Context Engineering, and Prompt Engineering. I develop intelligent systems, implement computer vision solutions, and create conversational AI applications.',
 ARRAY['yolov5', 'spacy', 'openrouter', 'genai', 'agentic ai', 'prompt engineering', 'ai', 'ml'],
 ARRAY['skills', 'ai', 'machine-learning'],
 9),

('education', 'academic', 'Bachelor of Technology in Computer Science',
 'Currently pursuing Bachelor of Technology in Computer Science Engineering at Sreyas Institute of Engineering and Technology, Hyderabad, Telangana (Nov 2021 – Aug 2025). Focusing on AI/ML, software development, and computer science fundamentals.',
 ARRAY['btech', 'computer science', 'engineering', 'sreyas institute', 'hyderabad', 'education'],
 ARRAY['education', 'degree', 'current'],
 7),

('contact', 'info', 'Contact Information',
 'You can reach me at manohar.kuncham03@gmail.com or call me at +91 9392269023. Connect with me on LinkedIn at https://linkedin.com/in/manohar-kumar or check out my GitHub at https://github.com/manohar-kumar. I am always open to discussing new opportunities and collaborations!',
 ARRAY['contact', 'email', 'phone', 'linkedin', 'github', 'reach', 'connect'],
 ARRAY['contact', 'communication'],
 10);

-- Create triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_conversation_context_updated_at 
  BEFORE UPDATE ON conversation_context 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_portfolio_content_updated_at 
  BEFORE UPDATE ON portfolio_content 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create a function to initialize a user session
CREATE OR REPLACE FUNCTION initialize_user_session(
  p_session_id VARCHAR(255),
  p_user_agent TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  session_uuid UUID;
BEGIN
  INSERT INTO user_sessions (session_id, user_agent, ip_address)
  VALUES (p_session_id, p_user_agent, p_ip_address)
  ON CONFLICT (session_id) 
  DO UPDATE SET 
    last_activity = NOW(),
    is_active = true
  RETURNING id INTO session_uuid;
  
  RETURN session_uuid;
END;
$$;