"use client"

import { Briefcase, Code, GraduationCap, Mail, Sparkles, User } from "lucide-react"

interface SuggestionButtonsProps {
  onSuggestionClick: (text: string) => void
}

export function SuggestionButtons({ onSuggestionClick }: SuggestionButtonsProps) {
  const suggestions = [
    { 
      label: "Experience", 
      text: "Tell me about your work experience at Consuy",
      icon: Briefcase,
      gradient: "from-blue-500 to-cyan-500"
    },
    { 
      label: "Projects", 
      text: "What are your most impressive projects like PrepBot?",
      icon: Code,
      gradient: "from-purple-500 to-pink-500"
    },
    { 
      label: "Skills", 
      text: "What programming languages and technologies do you know?",
      icon: Sparkles,
      gradient: "from-green-500 to-emerald-500"
    },
    { 
      label: "Education", 
      text: "Tell me about your educational background",
      icon: GraduationCap,
      gradient: "from-orange-500 to-red-500"
    },
    { 
      label: "AI Work", 
      text: "Describe your experience with AI and machine learning",
      icon: Sparkles,
      gradient: "from-indigo-500 to-purple-500"
    },
    { 
      label: "Contact", 
      text: "How can I get in touch with you?",
      icon: Mail,
      gradient: "from-teal-500 to-blue-500"
    },
  ]

  return (
    <div className="flex flex-wrap justify-center gap-3 w-full max-w-4xl">
      {suggestions.map((suggestion) => {
        const IconComponent = suggestion.icon
        return (
          <button
            key={suggestion.label}
            onClick={() => onSuggestionClick(suggestion.text)}
            className="group relative overflow-hidden px-6 py-3 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-full text-sm font-medium text-gray-700 hover:text-white transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 z-10"
          >
            {/* Gradient background that appears on hover */}
            <div className={`absolute inset-0 bg-gradient-to-r ${suggestion.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
            
            {/* Content */}
            <div className="relative flex items-center space-x-2">
              <IconComponent className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" />
              <span className="whitespace-nowrap">{suggestion.label}</span>
            </div>
            
            {/* Shine effect */}
            <div className="absolute inset-0 -top-2 -left-2 w-4 h-full bg-white opacity-20 transform rotate-12 translate-x-[-100%] group-hover:translate-x-[300%] transition-transform duration-700"></div>
          </button>
        )
      })}
    </div>
  )
}