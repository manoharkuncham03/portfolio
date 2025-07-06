"use client"

interface SuggestionButtonsProps {
  onSuggestionClick: (text: string) => void
}

export function SuggestionButtons({ onSuggestionClick }: SuggestionButtonsProps) {
  const suggestions = [
    { label: "Experience", text: "Tell me about your work experience at Consuy" },
    { label: "Projects", text: "What are your most impressive projects like PrepBot?" },
    { label: "Skills", text: "What programming languages and technologies do you know?" },
    { label: "Education", text: "Tell me about your educational background" },
    { label: "AI Work", text: "Describe your experience with AI and machine learning" },
    { label: "Contact", text: "How can I get in touch with you?" },
  ]

  return (
    <div className="flex flex-wrap justify-center gap-2 w-full">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.label}
          onClick={() => onSuggestionClick(suggestion.text)}
          className="px-3 py-2 border border-gray-200 rounded-full bg-white text-xs text-gray-800 hover:border-blue-500 hover:bg-gray-50 transition-all duration-300 whitespace-nowrap"
        >
          {suggestion.label}
        </button>
      ))}
    </div>
  )
}
