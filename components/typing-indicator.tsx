export function TypingIndicator() {
  return (
    <div className="mb-4 flex gap-3">
      {/* Bot Profile Icon */}
      <div className="flex-shrink-0">
        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 text-sm">
          🤖
        </div>
      </div>

      {/* Typing Animation */}
      <div className="flex flex-col items-start">
        <div className="p-3 rounded-xl bg-white border border-gray-200 flex items-center gap-1">
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
          </div>
        </div>
      </div>
    </div>
  )
}
