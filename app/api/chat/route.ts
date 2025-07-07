// app/api/chat/route.ts

import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

// Debug: Show loaded env variables (remove or mask in production)
console.log("OpenRouter API Key:", process.env.OPENROUTER_API_KEY ? "Loaded" : "Missing");
console.log("OpenRouter Model:", process.env.OPENROUTER_MODEL);
console.log("OpenRouter Base URL:", process.env.OPENROUTER_BASE_URL);
console.log("Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log("Supabase Service Role Key:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "Loaded" : "Missing");

// OpenRouter configuration
const openai = new OpenAI({
  baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY!,
  defaultHeaders: {
    "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://localhost:3000",
    "X-Title": process.env.NEXT_PUBLIC_SITE_NAME || "Portfolio Site",
  },
});

// Supabase configuration
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const maxDuration = 30;

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

  return relevantSections.sort((a, b) => b.relevance - a.relevance).slice(0, 3);
}

// Database initialization (idempotent)
async function initializeDatabase() {
  try {
    // Create tables if they don't exist
    const { error: tableError } = await supabase.rpc("create_portfolio_tables");
    if (tableError) console.log("Tables may already exist:", tableError.message);

    // Check if data already exists
    const { data: existingData } = await supabase.from("portfolio_content_simple").select("id").limit(1);

    if (!existingData || existingData.length === 0) {
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

      for (const chunk of contentChunks) {
        await supabase.from("portfolio_content_simple").insert({
          type: chunk.type,
          content: chunk.content,
          metadata: chunk.metadata,
          keywords: chunk.keywords,
        });
      }
    }
  } catch (error) {
    console.error("Database initialization error:", error);
  }
}

async function saveChatMessage(message: string, response: string, userId?: string) {
  try {
    await supabase.from("chat_history").insert({
      user_id: userId || "anonymous",
      user_message: message,
      bot_response: response,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error saving chat message:", error);
  }
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // Initialize database on first request
    await initializeDatabase();

    const lastMessage = messages[messages.length - 1];
    const userQuery = lastMessage.content;

    // Search for relevant content using keyword matching
    const relevantContent = searchRelevantContent(userQuery);

    // Create context from retrieved content
    const context =
      relevantContent.length > 0
        ? `Based on Manohar Kumar's portfolio information:\n${relevantContent.map((item) => item.content).join("\n\n")}`
        : `Here's what I know about Manohar Kumar: I'm an AI Developer and Frontend Developer with experience at Consuy.`;

    const systemPrompt = `You are Manohar Kumar's AI assistant. You have access to his complete portfolio information including experience, projects, skills, and education. 

${context}

Respond as if you are Manohar Kumar himself, using first person ("I", "my", "me"). Be conversational, professional, and provide specific details from the portfolio information. If asked about something not in the portfolio, politely redirect to what you do know about Manohar's background.

Key guidelines:
- Always respond in first person as Manohar Kumar
- Provide specific details from the portfolio
- Be enthusiastic about projects and achievements
- Include relevant contact information when appropriate
- Keep responses conversational but professional
- Limit responses to 2-3 paragraphs maximum`;

    let answer: string;

    try {
      const completion = await openai.chat.completions.create({
        model: process.env.OPENROUTER_MODEL || "mistralai/mistral-small-3.2-24b-instruct:free",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((m: any) => ({ role: m.role, content: m.content })),
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      answer = completion.choices?.[0]?.message?.content?.trim() ?? "Sorry, I'm not sure how to respond to that.";
    } catch (apiErr) {
      console.error("OpenRouter error:", apiErr);

      // graceful degradation
      answer = "I'm having trouble reaching my AI model right now, but here's some information about me:\n" + context;
    }

    // persist chat history (do not block the response)
    saveChatMessage(userQuery, answer).catch(console.error);

    return new Response(JSON.stringify({ content: answer }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("API Error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
