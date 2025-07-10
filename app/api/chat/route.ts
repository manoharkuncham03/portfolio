// app/api/chat/route.ts

import OpenAI from "openai";
import { databaseManager, initializeDatabase } from "@/lib/database-manager";

// Debug: Show loaded env variables (remove or mask in production)
console.log("OpenRouter API Key:", process.env.OPENROUTER_API_KEY ? "Loaded" : "Missing");
console.log("OpenRouter Model:", process.env.OPENROUTER_MODEL);
console.log("OpenRouter Base URL:", process.env.OPENROUTER_BASE_URL);

// OpenRouter configuration
const openai = new OpenAI({
  baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY!,
  defaultHeaders: {
    "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://localhost:3000",
    "X-Title": process.env.NEXT_PUBLIC_SITE_NAME || "Portfolio Site",
  },
});

export const maxDuration = 60; // Increased from 30 to 60 seconds

// Portfolio information (from environment or fallback)
const MANOHAR_INFO = {
  personal: {
    name: process.env.PERSONAL_NAME || "Kuncham Manohar Kumar",
    email: process.env.PERSONAL_EMAIL || "manohar.kuncham03@gmail.com",
    phone: process.env.PERSONAL_PHONE || "+91 9392269023",
    linkedin: process.env.PERSONAL_LINKEDIN || "https://linkedin.com/in/manohar-kumar",
    github: process.env.PERSONAL_GITHUB || "https://github.com/manohar-kumar",
  },
  experience: [
    {
      company: "Consuy",
      position: "AI Developer Intern",
      duration: "March 2025 – Present",
      responsibilities: [
        "Engineered and orchestrated multi-agent systems using CrewAI and Azure OpenAI services, reducing ticket creation time by significantly streamlining the process through automated data extraction and pre-filling of ticket fields.",
        "Implemented intelligent ticket assignment functionality based on real-time workgroup member availability, integrating the system with an availability management API to automatically assign tickets to the available member.",
        "Boosted the intelligence and effectiveness of AI agents by fine-tuning them on a rich dataset derived from the database, allowing them to better understand context, extract relevant information, and make more informed decisions.",
      ],
    },
    {
      company: "Consuy",
      position: "Frontend Developer Intern",
      duration: "July 2024 – March 2025",
      responsibilities: [
        "Engineered a production-ready frontend application using React and TypeScript, prioritizing a responsive and accessible user experience across diverse devices and WCAG 2.1 guidelines for accessibility compliance.",
        "Integrated RESTful APIs developed with Python and FastAPI, optimizing data fetching by implementing client-side caching strategies and efficient API call patterns, resulting in a significant reduction in data load times and a smoother user experience.",
        "Optimized frontend performance for a robust and efficient user experience by implementing techniques such as lazy loading components, memoization to prevent unnecessary re-renders, and conducting performance audits with Lighthouse.",
      ],
    },
  ],
  projects: [
    {
      name: "PrepBot",
      technologies: ["React", "Tarvus", "OpenAI"],
      description:
        "Developed a high-performance React + TypeScript frontend with WebRTC webcam capture embedding a TARVUS-driven avatar and live transcription overlays to achieve sub-200 ms conversational latency. Built a modular backend using Python FastAPI to orchestrate TARVUS avatar generation and ElevenLabs TTS pipelines for real-time question delivery and response processing. Implemented an extensible AI feedback suite leveraging OpenAI GPT-4 for semantic answer scoring, custom filler-word detection algorithms, and spaCy-based resume parsing.",
    },
    {
      name: "Code Pulse",
      technologies: ["Python", "Streamlit"],
      description:
        "Developed a comprehensive code analysis tool that performs critical assessments across multiple languages, improving code quality review efficiency. Achieved a 65% reduction in manual code review time by automating code quality checks for large-scale projects, enabling teams to focus on critical issues faster.",
    },
    {
      name: "Smart Video Surveillance System",
      technologies: ["Python", "YOLOv5"],
      description:
        "Engineered a video surveillance system capable of handling up to 10 concurrent video streams at 30 FPS, providing real-time face recognition with an 89% accuracy rate. Integrated YOLOv5 for efficient object detection and face recognition. Implemented a scalable alerting system, delivering over 20 real-time alerts per minute with sub-500 ms latency.",
    },
  ],
  skills: {
    programming: ["Python", "JavaScript", "C"],
    webDevelopment: ["HTML/CSS", "Tailwind CSS", "React", "NextJS"],
    aiMl: ["YOLOv5", "SpaCy", "OpenRouter", "GenAI", "Agentic AI", "Context Engineering", "Prompt Engineering"],
    databases: ["MySQL", "Neo4j"],
  },
  education: {
    institution: "Sreyas Institute of Engineering and Technology",
    degree: "Bachelor of Technology in Computer Science Engineering",
    duration: "Nov 2021 – Aug 2025",
    location: "Hyderabad, Telangana",
  },
};

// Keyword-based search
function searchRelevantContent(query: string) {
  const lowerQuery = query.toLowerCase();
  const relevantSections = [];

  if (
    lowerQuery.includes("contact") ||
    lowerQuery.includes("email") ||
    lowerQuery.includes("phone") ||
    lowerQuery.includes("reach")
  ) {
    relevantSections.push({
      type: "personal",
      content: `Name: ${MANOHAR_INFO.personal.name}, Email: ${MANOHAR_INFO.personal.email}, Phone: ${MANOHAR_INFO.personal.phone}, LinkedIn: ${MANOHAR_INFO.personal.linkedin}, GitHub: ${MANOHAR_INFO.personal.github}`,
      relevance: 0.9,
    });
  }

  if (
    lowerQuery.includes("experience") ||
    lowerQuery.includes("work") ||
    lowerQuery.includes("job") ||
    lowerQuery.includes("consuy") ||
    lowerQuery.includes("intern")
  ) {
    MANOHAR_INFO.experience.forEach((exp) => {
      relevantSections.push({
        type: "experience",
        content: `${exp.position} at ${exp.company} (${exp.duration}): ${exp.responsibilities.join(" ")}`,
        relevance: 0.8,
      });
    });
  }

  if (
    lowerQuery.includes("project") ||
    lowerQuery.includes("prepbot") ||
    lowerQuery.includes("code pulse") ||
    lowerQuery.includes("surveillance") ||
    lowerQuery.includes("build") ||
    lowerQuery.includes("developed")
  ) {
    MANOHAR_INFO.projects.forEach((project) => {
      relevantSections.push({
        type: "project",
        content: `${project.name} - Technologies: ${project.technologies.join(", ")}. ${project.description}`,
        relevance: 0.8,
      });
    });
  }

  if (
    lowerQuery.includes("skill") ||
    lowerQuery.includes("technology") ||
    lowerQuery.includes("programming") ||
    lowerQuery.includes("language") ||
    lowerQuery.includes("python") ||
    lowerQuery.includes("javascript") ||
    lowerQuery.includes("react")
  ) {
    relevantSections.push({
      type: "skills",
      content: `Programming Languages: ${MANOHAR_INFO.skills.programming.join(", ")}. Web Development: ${MANOHAR_INFO.skills.webDevelopment.join(", ")}. AI/ML: ${MANOHAR_INFO.skills.aiMl.join(", ")}. Databases: ${MANOHAR_INFO.skills.databases.join(", ")}`,
      relevance: 0.7,
    });
  }

  if (
    lowerQuery.includes("education") ||
    lowerQuery.includes("degree") ||
    lowerQuery.includes("college") ||
    lowerQuery.includes("university") ||
    lowerQuery.includes("study")
  ) {
    relevantSections.push({
      type: "education",
      content: `${MANOHAR_INFO.education.degree} from ${MANOHAR_INFO.education.institution}, ${MANOHAR_INFO.education.location} (${MANOHAR_INFO.education.duration})`,
      relevance: 0.7,
    });
  }

  if (relevantSections.length === 0) {
    relevantSections.push({
      type: "general",
      content: `I'm ${MANOHAR_INFO.personal.name}, an AI Developer and Frontend Developer with experience at Consuy. I've worked on projects like PrepBot, Code Pulse, and Smart Video Surveillance System. I'm skilled in Python, JavaScript, React, and AI/ML technologies.`,
      relevance: 0.5,
    });
  }

  return relevantSections.sort((a, b) => b.relevance - a.relevance).slice(0, 5); // Increased from 3 to 5
}

// Database initialization with optimized error handling
async function initializeDatabase() {
  try {
    // Initialize database with proper error handling
    const { success, errors } = await initializeDatabase();
    
    if (!success) {
      console.error("Database initialization failed:", errors);
      return;
    }

    // Check if data already exists using optimized query
    const existingData = await databaseManager.getPortfolioContent(undefined, true);

    if (!existingData || existingData.length === 0) {
      console.log("Populating initial portfolio data...");
      const contentChunks = [
        {
          type: "personal",
          content: `Name: ${MANOHAR_INFO.personal.name}, Email: ${MANOHAR_INFO.personal.email}, Phone: ${MANOHAR_INFO.personal.phone}`,
          metadata: MANOHAR_INFO.personal,
          keywords: "contact email phone reach connect linkedin github",
        },
        ...MANOHAR_INFO.experience.map((exp) => ({
          type: "experience",
          content: `${exp.position} at ${exp.company} (${exp.duration}): ${exp.responsibilities.join(" ")}`,
          metadata: exp,
          keywords: "experience work job consuy intern developer frontend ai",
        })),
        ...MANOHAR_INFO.projects.map((project) => ({
          type: "project",
          content: `${project.name} - Technologies: ${project.technologies.join(", ")}. ${project.description}`,
          metadata: project,
          keywords: `project ${project.name.toLowerCase()} ${project.technologies.join(" ").toLowerCase()} build developed`,
        })),
        {
          type: "skills",
          content: `Programming Languages: ${MANOHAR_INFO.skills.programming.join(", ")}. Web Development: ${MANOHAR_INFO.skills.webDevelopment.join(", ")}. AI/ML: ${MANOHAR_INFO.skills.aiMl.join(", ")}. Databases: ${MANOHAR_INFO.skills.databases.join(", ")}`,
          metadata: MANOHAR_INFO.skills,
          keywords: "skills technology programming language python javascript react ai ml database",
        },
        {
          type: "education",
          content: `${MANOHAR_INFO.education.degree} from ${MANOHAR_INFO.education.institution}, ${MANOHAR_INFO.education.location} (${MANOHAR_INFO.education.duration})`,
          metadata: MANOHAR_INFO.education,
          keywords: "education degree college university study bachelor computer science",
        },
      ];

      // Use batch insert for better performance
      try {
        const { error } = await databaseManager.supabase
          .from("portfolio_content_simple")
          .insert(contentChunks);
        
        if (error) {
          console.error("Error inserting initial data:", error);
        } else {
          console.log("Initial portfolio data inserted successfully");
        }
      } catch (error) {
        console.error("Error during batch insert:", error);
      }
    } else {
      console.log("Portfolio data already exists, skipping initialization");
    }
  } catch (error) {
    console.error("Database initialization error:", error);
  }
}

// Optimized chat message saving with session management
async function saveChatMessage(
  message: string, 
  response: string, 
  sessionId: string = "anonymous",
  metadata: any = {}
): Promise<boolean> {
  try {
    // Initialize session if needed
    await databaseManager.initializeSession(sessionId);
    
    // Store conversation with metadata
    const success = await databaseManager.storeConversation(
      sessionId,
      message,
      response,
      metadata
    );
    
    if (!success) {
      console.error("Failed to store conversation");
    }
    
    return success;
  } catch (error) {
    console.error("Error saving chat message:", error);
    return false;
  }
}

export async function POST(req: Request) {
  const startTime = Date.now();
  
  try {
    const { messages } = await req.json();

    // Initialize database with optimized error handling
    try {
      await initializeDatabase();
    } catch (dbError) {
      console.error("Database initialization failed:", dbError);
      // Continue with request even if DB init fails
    }

    const lastMessage = messages[messages.length - 1];
    const userQuery = lastMessage.content;
    const sessionId = req.headers.get('x-session-id') || `session_${Date.now()}`;

    // Search for relevant content using keyword matching
    const relevantContent = searchRelevantContent(userQuery);

    // Create context from retrieved content
    const context =
      relevantContent.length > 0
        ? `Based on Manohar Kumar's portfolio information:\n${relevantContent.map((item) => item.content).join("\n\n")}`
        : `Here's what I know about Manohar Kumar: I'm an AI Developer and Frontend Developer with experience at Consuy.`;

    // Enhanced system prompt with better instructions for complete responses
    const systemPrompt = `You are Manohar Kumar's AI assistant. You have access to his complete portfolio information including experience, projects, skills, and education. 

${context}

CRITICAL INSTRUCTIONS:
- Respond as if you are Manohar Kumar himself, using first person ("I", "my", "me")
- ALWAYS provide COMPLETE and COMPREHENSIVE responses
- Do NOT truncate or cut off your responses mid-sentence
- Ensure every response has a proper conclusion
- Be conversational, professional, and provide specific details from the portfolio information
- If asked about something not in the portfolio, politely redirect to what you do know about Manohar's background

Key guidelines:
- Always respond in first person as Manohar Kumar
- Provide specific details from the portfolio with examples
- Be enthusiastic about projects and achievements
- Include relevant contact information when appropriate
- Keep responses conversational but professional
- Structure responses with clear sections when discussing multiple topics
- Always complete your thoughts and provide proper endings to responses

Response Formatting Guidelines:
- Use proper markdown formatting for better readability
- Structure responses with clear sections using headings (##, ###) when appropriate
- Use bullet points (- item) or numbered lists (1. step) for listing items or steps
- Format code snippets with triple backticks and language identifier: \`\`\`python\`\`\`
- Use **bold** or *italic* for emphasis on important points
- Create tables with pipe syntax when comparing or presenting structured data
- Organize technical content with proper indentation and spacing
- Use blockquotes (>) for testimonials or important highlights
- Include line breaks between paragraphs for better readability
- Keep overall response clean and well-organized
- Ensure code examples are properly formatted with the correct language syntax highlighting

IMPORTANT: Always ensure your response is complete and ends naturally. Never cut off mid-sentence or leave thoughts incomplete.`;

    let answer: string;

    try {
      const completion = await openai.chat.completions.create({
        model: process.env.OPENROUTER_MODEL || "mistralai/mistral-small-3.2-24b-instruct:free",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((m: any) => ({ role: m.role, content: m.content })),
        ],
        max_tokens: 2000, // Increased from 500 to 2000
        temperature: 0.7,
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1,
      });

      answer = completion.choices?.[0]?.message?.content?.trim() ?? "Sorry, I'm not sure how to respond to that.";
      
      // Check if response seems truncated and warn
      if (answer.length > 1800 && !answer.match(/[.!?]$/)) {
        answer += "\n\n*Note: This response may have been truncated. Feel free to ask me to continue or elaborate on any specific point!*";
      }
      
    } catch (apiErr) {
      console.error("OpenRouter error:", apiErr);

      // Enhanced graceful degradation with more context
      answer = `I'm having trouble reaching my AI model right now, but here's some information about me based on your question:\n\n${context}\n\nPlease try asking again in a moment, and I'll be happy to provide a more detailed response!`;
    }

    // Persist chat history with metadata (non-blocking)
    const responseTime = Date.now() - startTime;
    saveChatMessage(userQuery, answer, sessionId, {
      responseTime,
      model: process.env.OPENROUTER_MODEL,
      relevantContentCount: relevantContent.length,
      contextUsed: relevantContent.map(item => item.type)
    }).catch(console.error);

    return new Response(JSON.stringify({ content: answer }), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "X-Response-Time": `${responseTime}ms`
      },
    });
  } catch (error) {
    console.error("API Error:", error);
    return new Response(JSON.stringify({ 
      error: "Internal Server Error",
      message: "I encountered an error while processing your request. Please try again."
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}