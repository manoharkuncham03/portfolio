import { Bot } from "lucide-react"

export function TypingIndicator() {
  return (
    <div className="mb-6 flex gap-4">
      {/* Bot Avatar */}
      <div className="flex-shrink-0">
        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-r from-gray-100 to-gray-200 text-gray-600 border-2 border-white shadow-lg">
          <Bot className="w-5 h-5" />
        </div>
      </div>

      {/* Typing Animation */}
      <div className="flex flex-col items-start">
        <div className="p-4 rounded-3xl rounded-bl-lg bg-white border border-gray-100 shadow-lg flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
          </div>
          <span className="text-sm text-gray-500 ml-2">Thinking...</span>
        </div>
      </div>
    </div>
  )
}