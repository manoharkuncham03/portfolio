# Manohar Kumar Portfolio Chatbot

A modern, interactive personal portfolio website that functions as a chatbot interface using Next.js, Tailwind CSS, and OpenRouter AI.

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

### Required Environment Variables

\`\`\`env
# OpenRouter Configuration
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=mistralai/mistral-small-3.2-24b-instruct:free

# Site Information
NEXT_PUBLIC_SITE_URL=https://your-domain.com
NEXT_PUBLIC_SITE_NAME=Your Site Name

# Personal Information
PERSONAL_NAME=Your Full Name
PERSONAL_EMAIL=your.email@example.com
PERSONAL_PHONE=+1234567890
PERSONAL_LINKEDIN=https://linkedin.com/in/your-profile
PERSONAL_GITHUB=https://github.com/your-username

# Database Configuration (Supabase)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
\`\`\`

### Getting API Keys

1. **OpenRouter API Key**: Sign up at [OpenRouter](https://openrouter.ai/) and get your API key
2. **Supabase**: Create a project at [Supabase](https://supabase.com/) and get your URL and service role key

## Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables in `.env.local`
4. Run the development server: `npm run dev`

## Features

- Interactive chatbot interface
- RAG (Retrieval-Augmented Generation) implementation
- Database integration for chat history
- Responsive design with Tailwind CSS
- OpenRouter AI integration
- Secure environment variable management

## Security

- All sensitive information is stored in environment variables
- API keys and personal information are never exposed to the client
- Database credentials are properly secured
- `.env` files are excluded from version control
"# probable-invention" 
