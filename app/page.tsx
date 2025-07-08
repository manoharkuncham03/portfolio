"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { ChatMessage } from "@/components/chat-message"
import { SuggestionButtons } from "@/components/suggestion-buttons"
import { TypingIndicator } from "@/components/typing-indicator"
import { ArrowUp, Sparkles } from "lucide-react"

interface Message {
  id: string
  text: string
  sender: "user" | "bot"
  timestamp: string
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isChatVisible, setIsChatVisible] = useState(false)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const getCurrentTime = () => {
    const now = new Date()
    return now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }

  const addMessage = (text: string, sender: "user" | "bot") => {
    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      sender,
      timestamp: getCurrentTime(),
    }
    setMessages((prev) => [...prev, newMessage])
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput("")

    if (!isChatVisible) {
      setIsChatVisible(true)
    }

    // Add user message
    addMessage(userMessage, "user")
    setIsLoading(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...messages.map((m) => ({
              role: m.sender === "user" ? "user" : "assistant",
              content: m.text,
            })),
            { role: "user", content: userMessage },
          ],
        }),
      })

      if (!response.ok) throw new Error("Failed to get response")

      const { content } = await response.json()
      if (content) addMessage(content, "bot")
    } catch (error) {
      console.error("Error:", error)
      addMessage("Sorry, I encountered an error. Please try again.", "bot")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSuggestionClick = async (text: string) => {
    setInput(text)
    if (!isChatVisible) {
      setIsChatVisible(true)
    }
    
    // Auto-execute the suggestion
    addMessage(text, "user")
    setIsLoading(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...messages.map((m) => ({
              role: m.sender === "user" ? "user" : "assistant",
              content: m.text,
            })),
            { role: "user", content: text },
          ],
        }),
      })

      if (!response.ok) throw new Error("Failed to get response")

      const { content } = await response.json()
      if (content) addMessage(content, "bot")
    } catch (error) {
      console.error("Error:", error)
      addMessage("Sorry, I encountered an error. Please try again.", "bot")
    } finally {
      setIsLoading(false)
    }
  }

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages, isLoading])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px'
    }
  }, [input])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col items-center p-4 md:p-8">
      <div className="w-full max-w-4xl flex flex-col items-center">
        {/* Header Section */}
        <header className="text-center mb-8 relative">
          {/* Animated background elements */}
          <div className="absolute -top-4 -left-4 w-20 h-20 bg-blue-100 rounded-full opacity-60 animate-pulse"></div>
          <div className="absolute -top-2 -right-6 w-16 h-16 bg-purple-100 rounded-full opacity-40 animate-pulse delay-1000"></div>
          
          {/* Main emoji with glow effect */}
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full blur-xl opacity-30 animate-pulse"></div>
            <span className="relative text-6xl md:text-7xl block animate-bounce">👋</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-gray-800 via-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Hey, I'm Manohar Kumar
          </h1>
          
          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            AI Developer & Frontend Engineer passionate about creating intelligent solutions
          </p>
          
          {/* Sparkle decorations */}
          <div className="absolute top-1/2 left-1/4 transform -translate-x-1/2 -translate-y-1/2">
            <Sparkles className="w-6 h-6 text-yellow-400 animate-pulse" />
          </div>
          <div className="absolute top-1/3 right-1/4 transform translate-x-1/2 -translate-y-1/2">
            <Sparkles className="w-4 h-4 text-blue-400 animate-pulse delay-500" />
          </div>
        </header>

        {/* Chat Interface */}
        {isChatVisible && (
          <div
            ref={chatContainerRef}
            className="w-full max-w-4xl max-h-96 overflow-y-auto p-6 border border-gray-200 rounded-3xl bg-white/80 backdrop-blur-sm shadow-xl mb-6 scroll-smooth"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#cbd5e1 transparent'
            }}
          >
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isLoading && <TypingIndicator />}
          </div>
        )}

        {/* Input Section */}
        <form onSubmit={handleSubmit} className="w-full max-w-3xl relative mb-6">
          <div className="relative bg-white rounded-full shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 focus-within:shadow-xl focus-within:border-blue-300">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me about my experience, projects, skills, or anything else..."
              className="w-full min-h-[60px] max-h-[120px] py-4 px-6 pr-16 bg-transparent rounded-full text-base resize-none focus:outline-none placeholder-gray-500 leading-relaxed"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
              rows={1}
            />
            
            {/* Send Button */}
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white rounded-full flex items-center justify-center transition-all duration-300 shadow-lg hover:shadow-xl disabled:shadow-none group"
            >
              <ArrowUp className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
            </button>
          </div>
        </form>

        {/* Suggestion Buttons */}
        <SuggestionButtons onSuggestionClick={handleSuggestionClick} />
        
        {/* Footer */}
        <footer className="mt-12 text-center text-gray-500 text-sm">
          <p>Powered by AI • Built with ❤️ by Manohar Kumar</p>
        </footer>
      </div>
    </div>
  )
}