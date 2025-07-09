"use client"

import { Briefcase, Code, GraduationCap, Mail, Sparkles, User } from "lucide-react"
import { LiquidButton } from "@/components/ui/liquid-glass-button"

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

  return (
    <div className="flex flex-wrap justify-center gap-4 w-full max-w-4xl">
      {suggestions.map((suggestion) => {
        const IconComponent = suggestion.icon
        return (
          <LiquidButton
            key={suggestion.label}
            onClick={() => onSuggestionClick(suggestion.text)}
            size="lg"
            className={`group relative overflow-hidden transition-all duration-300 z-10 ${suggestion.color} hover:text-white font-medium`}
          >
            {/* Gradient background overlay that appears on hover */}
            <div className={`absolute inset-0 bg-gradient-to-r ${suggestion.gradient} opacity-0 group-hover:opacity-90 transition-all duration-300 rounded-md z-0`}></div>
            
            {/* Content with proper z-index */}
            <div className="relative flex items-center space-x-2 z-10">
              <IconComponent className="w-5 h-5 transition-all duration-300 group-hover:scale-110 group-hover:text-white" />
              <span className="whitespace-nowrap transition-colors duration-300 group-hover:text-white">{suggestion.label}</span>
            </div>
            
            {/* Enhanced shine effect */}
            <div className="absolute inset-0 -top-2 -left-2 w-6 h-full bg-white opacity-30 transform rotate-12 translate-x-[-100%] group-hover:translate-x-[300%] transition-transform duration-700 z-20"></div>
          </LiquidButton>
        )
      })}
    </div>
  )
}