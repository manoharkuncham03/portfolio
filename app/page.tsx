"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { ChatMessage } from "@/components/chat-message"
import { SuggestionButtons } from "@/components/suggestion-buttons"
import { TypingIndicator } from "@/components/typing-indicator"
import { SplashCursor } from "@/components/ui/splash-cursor"
import { DarkModeToggle } from "@/components/ui/dark-mode-toggle"
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
      // Increased timeout for longer responses
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Add timeout and better error handling
        signal: AbortSignal.timeout(90000), // 90 seconds timeout
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
      addMessage("I apologize, but I encountered an error while processing your request. This might be due to a network issue or the response taking longer than expected. Please try asking your question again, and I'll do my best to provide a complete answer.", "bot")
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
      // Increased timeout for longer responses
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(90000), // 90 seconds timeout
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
      addMessage("I apologize, but I encountered an error while processing your request. This might be due to a network issue or the response taking longer than expected. Please try asking your question again, and I'll do my best to provide a complete answer.", "bot")
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
      {/* Interactive Splash Cursor Effect */}
      <SplashCursor 
        SPLAT_RADIUS={0.15}
        SPLAT_FORCE={4000}
        COLOR_UPDATE_SPEED={8}
        DENSITY_DISSIPATION={2.0}
        VELOCITY_DISSIPATION={1.5}
        CURL={20}
        PRESSURE={0.6}
      />
      
      <div className="w-full max-w-4xl flex flex-col items-center">
        {/* Header Section */}
        <header className="text-center mb-8 relative">
          {/* Dark Mode Toggle */}
          <div className="absolute top-0 right-0">
            <DarkModeToggle size="md" />
          </div>
          
          {/* Animated background elements */}
          <div className="absolute -top-4 -left-4 w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full opacity-60 animate-pulse"></div>
          <div className="absolute -top-2 -right-6 w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full opacity-40 animate-pulse delay-1000"></div>
          
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-gray-800 via-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Hey, I'm Manohar Kumar
          </h1>
          
          {/* Sparkle decorations */}
          <div className="absolute top-1/2 left-1/4 transform -translate-x-1/2 -translate-y-1/2">
            <Sparkles className="w-6 h-6 text-yellow-400 dark:text-yellow-300 animate-pulse" />
          </div>
          <div className="absolute top-1/3 right-1/4 transform translate-x-1/2 -translate-y-1/2">
            <Sparkles className="w-4 h-4 text-blue-400 dark:text-blue-300 animate-pulse delay-500" />
          </div>
        </header>

        {/* Chat Interface */}
        {isChatVisible && (
          <div
            ref={chatContainerRef}
            className="w-full max-w-4xl max-h-96 overflow-y-auto p-6 border border-gray-200 dark:border-gray-700 rounded-3xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-xl mb-6 scroll-smooth"
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
          <div className="relative bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-full shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-300 focus-within:shadow-xl focus-within:border-blue-300 dark:focus-within:border-blue-500">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me about my experience, projects, skills, or anything else..."
              className="w-full min-h-[60px] max-h-[120px] py-4 px-6 pr-16 bg-transparent rounded-full text-base resize-none focus:outline-none placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-gray-100 leading-relaxed relative z-10"
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
              className="absolute right-3 top-1/2 transform -translate-y-1/2 w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white rounded-full flex items-center justify-center transition-all duration-300 shadow-lg hover:shadow-xl disabled:shadow-none group hover:scale-105 active:scale-95 z-10"
            >
              <ArrowUp className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
            </button>
          </div>
        </form>

        {/* Suggestion Buttons */}
        <SuggestionButtons onSuggestionClick={handleSuggestionClick} />
        
        {/* Footer */}
        <footer className="mt-12 text-center text-gray-500 dark:text-gray-400 text-sm relative z-10">
          <p>© 2024 Manohar Kumar. All rights reserved.</p>
        </footer>
      </div>
    </div>
  )
}