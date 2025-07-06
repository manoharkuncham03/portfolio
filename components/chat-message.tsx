interface Message {
  id: string
  text: string
  sender: "user" | "bot"
  timestamp: string
}

interface ChatMessageProps {
  message: Message
}

export function ChatMessage({ message }: ChatMessageProps) {
  return (
    <div className={`mb-4 flex gap-3 ${message.sender === "user" ? "flex-row-reverse" : "flex-row"}`}>
      {/* Profile Icon */}
      <div className="flex-shrink-0">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium">
          {message.sender === "user" ? (
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white">👤</div>
          ) : (
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-600">🤖</div>
          )}
        </div>
      </div>

      {/* Message Content */}
      <div
        className={`flex flex-col max-w-[80%] md:max-w-[85%] ${message.sender === "user" ? "items-end" : "items-start"}`}
      >
        <div
          className={`p-3 rounded-xl break-words ${
            message.sender === "user" ? "bg-blue-500 text-white" : "bg-white text-gray-800 border border-gray-200"
          }`}
        >
          {message.text}
        </div>
        <div className="text-xs opacity-70 mt-1">{message.timestamp}</div>
      </div>
    </div>
  )
}
