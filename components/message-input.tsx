"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"

interface MessageInputProps {
  onSendMessage: (message: string) => void
}

export function MessageInput({ onSendMessage }: MessageInputProps) {
  const [message, setMessage] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "60px"
      const scrollHeight = textareaRef.current.scrollHeight
      const maxHeight = 200

      if (scrollHeight > 60) {
        textareaRef.current.style.height = Math.min(scrollHeight, maxHeight) + "px"
      }
    }
  }

  const handleSubmit = () => {
    if (message.trim()) {
      onSendMessage(message.trim())
      setMessage("")
      if (textareaRef.current) {
        textareaRef.current.style.height = "60px"
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
    adjustTextareaHeight()
  }

  useEffect(() => {
    adjustTextareaHeight()
  }, [message])

  return (
    <div className="w-full max-w-3xl relative mb-5">
      <textarea
        ref={textareaRef}
        value={message}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Type your message here..."
        className="w-full min-h-[60px] max-h-[200px] py-4 px-4 pr-16 border-2 border-gray-200 rounded-xl text-base bg-gray-50 resize-none focus:outline-none focus:border-blue-500 focus:bg-white transition-all duration-300 placeholder-gray-500"
        style={{ height: "60px" }}
      />
      <button
        onClick={handleSubmit}
        disabled={!message.trim()}
        className="absolute right-3 top-1/2 transform -translate-y-1/2 w-10 h-10 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center text-lg transition-colors duration-300"
      >
        ➤
      </button>
    </div>
  )
}
