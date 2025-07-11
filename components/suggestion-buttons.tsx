"use client"

import { Briefcase, Code, GraduationCap, Mail, Sparkles, User } from "lucide-react"
import { motion } from "framer-motion"

interface SuggestionButtonsProps {
  onSuggestionClick: (text: string) => void
}

export function SuggestionButtons({ onSuggestionClick }: SuggestionButtonsProps) {
  const suggestions = [
    { 
      label: "Experience", 
      text: "Tell me about your work experience at Consuy",
      icon: Briefcase,
      gradient: "from-blue-500 to-cyan-500",
      color: "text-blue-600"
    },
    { 
      label: "Projects", 
      text: "What are your most impressive projects like PrepBot?",
      icon: Code,
      gradient: "from-purple-500 to-pink-500",
      color: "text-purple-600"
    },
    { 
      label: "Skills", 
      text: "What programming languages and technologies do you know?",
      icon: Sparkles,
      gradient: "from-green-500 to-emerald-500",
      color: "text-green-600"
    },
    { 
      label: "Education", 
      text: "Tell me about your educational background",
      icon: GraduationCap,
      gradient: "from-orange-500 to-red-500",
      color: "text-orange-600"
    },
    { 
      label: "AI Work", 
      text: "Describe your experience with AI and machine learning",
      icon: Sparkles,
      gradient: "from-indigo-500 to-purple-500",
      color: "text-indigo-600"
    },
    { 
      label: "Contact", 
      text: "How can I get in touch with you?",
      icon: Mail,
      gradient: "from-teal-500 to-blue-500",
      color: "text-teal-600"
    },
  ]

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

  const itemVariants = {
    hidden: { 
      opacity: 0, 
      y: 20,
      scale: 0.8
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

  return (
    <motion.div 
      className="flex flex-wrap justify-center gap-4 w-full max-w-4xl"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {suggestions.map((suggestion, index) => {
        const IconComponent = suggestion.icon
        return (
          <motion.div
            key={suggestion.label}
            variants={itemVariants}
            whileHover={{ 
              scale: 1.05,
              transition: { type: "spring", stiffness: 400, damping: 10 }
            }}
            whileTap={{ 
              scale: 0.95,
              transition: { type: "spring", stiffness: 400, damping: 10 }
            }}
            className="relative group"
          >
            <motion.button
              onClick={() => onSuggestionClick(suggestion.text)}
              className={`
                relative overflow-hidden
                w-24 h-24 
                border-4 border-white
                bg-white/90 backdrop-blur-sm
                transition-all duration-300
                ${suggestion.color} hover:text-white
                font-medium text-sm
                shadow-lg hover:shadow-xl
                group
              `}
              style={{ borderRadius: 0 }}
              whileHover={{
                boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
              }}
            >
              {/* Gradient background overlay that appears on hover */}
              <motion.div 
                className={`absolute inset-0 bg-gradient-to-br ${suggestion.gradient} opacity-0 group-hover:opacity-100`}
                initial={{ opacity: 0 }}
                whileHover={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              />
              
              {/* Content */}
              <div className="relative flex flex-col items-center justify-center h-full space-y-1 z-10">
                <motion.div
                  whileHover={{ 
                    scale: 1.2,
                    rotate: 5,
                    transition: { type: "spring", stiffness: 300, damping: 10 }
                  }}
                >
                  <IconComponent className="w-6 h-6 transition-all duration-300 group-hover:text-white" />
                </motion.div>
                <span className="text-xs leading-tight text-center transition-colors duration-300 group-hover:text-white px-1">
                  {suggestion.label}
                </span>
              </div>
              
              {/* Enhanced shine effect */}
              <motion.div 
                className="absolute inset-0 w-6 h-full bg-white opacity-30 transform rotate-12 translate-x-[-100%] group-hover:translate-x-[300%] transition-transform duration-700 z-20"
                initial={{ x: "-100%" }}
                whileHover={{ x: "300%" }}
                transition={{ duration: 0.7, ease: "easeInOut" }}
              />
            </motion.button>
          </motion.div>
        )
      })}
    </motion.div>
  )
}