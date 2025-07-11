"use client"

import { motion } from "framer-motion"
import { ExternalLink, Github, Calendar, Tag } from "lucide-react"

interface Project {
  id: string
  title: string
  description: string
  technologies: string[]
  imageUrl: string
  githubUrl?: string
  liveUrl?: string
  category: string
  year: string
}

interface ProjectsGridProps {
  projects?: Project[]
}

const defaultProjects: Project[] = [
  {
    id: "1",
    title: "PrepBot",
    description: "High-performance React + TypeScript frontend with WebRTC webcam capture, TARVUS-driven avatar, and live transcription overlays achieving sub-200ms conversational latency. Built modular backend using Python FastAPI with TARVUS avatar generation and ElevenLabs TTS pipelines.",
    technologies: ["React", "TypeScript", "WebRTC", "Python", "FastAPI", "OpenAI", "ElevenLabs"],
    imageUrl: "https://images.pexels.com/photos/8386440/pexels-photo-8386440.jpeg?auto=compress&cs=tinysrgb&w=800",
    githubUrl: "#",
    liveUrl: "#",
    category: "AI",
    year: "2024"
  },
  {
    id: "2",
    title: "Code Pulse",
    description: "Comprehensive code analysis tool that performs critical assessments across multiple programming languages. Achieved 65% reduction in manual code review time by automating code quality checks for large-scale projects.",
    technologies: ["Python", "Streamlit", "Code Analysis", "Automation"],
    imageUrl: "https://images.pexels.com/photos/1181671/pexels-photo-1181671.jpeg?auto=compress&cs=tinysrgb&w=800",
    githubUrl: "#",
    liveUrl: "#",
    category: "Tools",
    year: "2024"
  },
  {
    id: "3",
    title: "Smart Video Surveillance System",
    description: "Video surveillance system capable of handling up to 10 concurrent video streams at 30 FPS with 89% accuracy rate for face recognition. Integrated YOLOv5 for efficient object detection and implemented scalable alerting system.",
    technologies: ["Python", "YOLOv5", "Computer Vision", "Real-time Processing"],
    imageUrl: "https://images.pexels.com/photos/2599244/pexels-photo-2599244.jpeg?auto=compress&cs=tinysrgb&w=800",
    githubUrl: "#",
    liveUrl: "#",
    category: "AI",
    year: "2023"
  },
  {
    id: "4",
    title: "Portfolio Chatbot",
    description: "Interactive portfolio website with AI-powered chatbot interface using Next.js, Tailwind CSS, and OpenRouter AI. Features real-time conversations, context awareness, and responsive design.",
    technologies: ["Next.js", "TypeScript", "OpenAI", "Tailwind CSS", "Supabase"],
    imageUrl: "https://images.pexels.com/photos/8386434/pexels-photo-8386434.jpeg?auto=compress&cs=tinysrgb&w=800",
    githubUrl: "#",
    liveUrl: "#",
    category: "Web",
    year: "2024"
  },
  {
    id: "5",
    title: "Multi-Agent System",
    description: "Engineered multi-agent systems using CrewAI and Azure OpenAI services, reducing ticket creation time significantly through automated data extraction and intelligent ticket assignment functionality.",
    technologies: ["CrewAI", "Azure OpenAI", "Python", "Multi-Agent Systems"],
    imageUrl: "https://images.pexels.com/photos/8386422/pexels-photo-8386422.jpeg?auto=compress&cs=tinysrgb&w=800",
    githubUrl: "#",
    liveUrl: "#",
    category: "AI",
    year: "2024"
  },
  {
    id: "6",
    title: "React Performance Optimizer",
    description: "Frontend optimization tool that implements lazy loading, memoization, and performance auditing with Lighthouse. Achieved significant improvements in application load times and user experience.",
    technologies: ["React", "TypeScript", "Performance Optimization", "Lighthouse"],
    imageUrl: "https://images.pexels.com/photos/1181263/pexels-photo-1181263.jpeg?auto=compress&cs=tinysrgb&w=800",
    githubUrl: "#",
    liveUrl: "#",
    category: "Web",
    year: "2024"
  }
]

export function ProjectsGrid({ projects = defaultProjects }: ProjectsGridProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  }

  const cardVariants = {
    hidden: { 
      opacity: 0, 
      y: 50,
      scale: 0.9
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 20
      }
    }
  }

  const imageVariants = {
    hover: {
      scale: 1.1,
      transition: {
        duration: 0.3,
        ease: "easeOut"
      }
    }
  }

  const overlayVariants = {
    hover: {
      opacity: 1,
      transition: {
        duration: 0.3
      }
    }
  }

  return (
    <motion.div
      className="w-full max-w-7xl mx-auto px-4 py-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        variants={containerVariants}
      >
        {projects.map((project) => (
          <motion.div
            key={project.id}
            variants={cardVariants}
            whileHover={{ 
              y: -10,
              transition: { type: "spring", stiffness: 300, damping: 20 }
            }}
            className="group relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100"
          >
            {/* Project Image */}
            <div className="relative h-48 overflow-hidden">
              <motion.img
                src={project.imageUrl}
                alt={project.title}
                className="w-full h-full object-cover"
                variants={imageVariants}
                whileHover="hover"
              />
              
              {/* Overlay with links */}
              <motion.div
                className="absolute inset-0 bg-black/60 flex items-center justify-center space-x-4 opacity-0"
                variants={overlayVariants}
                whileHover="hover"
              >
                {project.githubUrl && (
                  <motion.a
                    href={project.githubUrl}
                    className="p-3 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-colors"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Github className="w-6 h-6 text-white" />
                  </motion.a>
                )}
                {project.liveUrl && (
                  <motion.a
                    href={project.liveUrl}
                    className="p-3 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-colors"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <ExternalLink className="w-6 h-6 text-white" />
                  </motion.a>
                )}
              </motion.div>

              {/* Category Badge */}
              <motion.div
                className="absolute top-4 left-4"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <span className="px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-xs font-medium text-gray-800">
                  {project.category}
                </span>
              </motion.div>

              {/* Year Badge */}
              <motion.div
                className="absolute top-4 right-4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <span className="px-3 py-1 bg-black/20 backdrop-blur-sm rounded-full text-xs font-medium text-white flex items-center space-x-1">
                  <Calendar className="w-3 h-3" />
                  <span>{project.year}</span>
                </span>
              </motion.div>
            </div>

            {/* Project Content */}
            <div className="p-6">
              <motion.h3
                className="text-xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                {project.title}
              </motion.h3>
              
              <motion.p
                className="text-gray-600 text-sm leading-relaxed mb-4 line-clamp-3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                {project.description}
              </motion.p>

              {/* Technologies */}
              <motion.div
                className="flex flex-wrap gap-2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                {project.technologies.slice(0, 4).map((tech, index) => (
                  <motion.span
                    key={tech}
                    className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-md font-medium hover:bg-gray-200 transition-colors"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.7 + index * 0.1 }}
                    whileHover={{ scale: 1.05 }}
                  >
                    {tech}
                  </motion.span>
                ))}
                {project.technologies.length > 4 && (
                  <motion.span
                    className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-md font-medium"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1.1 }}
                  >
                    +{project.technologies.length - 4} more
                  </motion.span>
                )}
              </motion.div>
            </div>

            {/* Hover Effect Border */}
            <motion.div
              className="absolute inset-0 border-2 border-blue-500 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
              initial={{ scale: 0.95 }}
              whileHover={{ scale: 1 }}
            />
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  )
}