"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { ChatMessage } from "@/components/chat-message"
import { SuggestionButtons } from "@/components/suggestion-buttons"
import { TypingIndicator } from "@/components/typing-indicator"

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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

  const handleSuggestionClick = (text: string) => {
    setInput(text)
    if (!isChatVisible) {
      setIsChatVisible(true)
    }
  }

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages, isLoading])

  return (
    <div className="min-h-screen bg-white flex flex-col items-center p-5">
      <div className="w-full max-w-4xl flex flex-col items-center">
        {/* Header Section */}
        <header className="text-center mb-5">
          <span className="text-5xl md:text-6xl block mb-5">👋</span>
          <h1 className="text-4xl md:text-5xl font-semibold text-gray-900 mb-5">Hey, I'm Manohar Kumar</h1>
        </header>

        {/* Chat Interface */}
        {isChatVisible && (
          <div
            ref={chatContainerRef}
            className="w-full max-w-3xl max-h-96 overflow-y-auto p-4 border border-gray-200 rounded-xl bg-gray-50 mb-5 scroll-smooth"
          >
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isLoading && <TypingIndicator />}
          </div>
        )}

        {/* Input Section */}
        <form onSubmit={handleSubmit} className="w-full max-w-3xl relative mb-5">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me about my experience, projects, skills, or anything else..."
            className="w-full min-h-[60px] max-h-[200px] py-4 px-4 pr-16 border-2 border-gray-200 rounded-xl text-base bg-gray-50 resize-none focus:outline-none focus:border-blue-500 focus:bg-white transition-all duration-300 placeholder-gray-500"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 w-10 h-10 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center text-lg transition-colors duration-300"
          >
            ➤
          </button>
        </form>

        {/* Suggestion Buttons */}
        <SuggestionButtons onSuggestionClick={handleSuggestionClick} />
      </div>
    </div>
  )
}
