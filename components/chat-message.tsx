'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check, Bot, User } from 'lucide-react'
import { useTheme } from 'next-themes'
import { motion } from 'framer-motion'

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
  const { theme } = useTheme()
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedCode(text)
      setTimeout(() => setCopiedCode(null), 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  return (
    <motion.div 
      className={`mb-6 flex gap-4 ${message.sender === "user" ? "flex-row-reverse" : "flex-row"}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Avatar */}
      <motion.div 
        className="flex-shrink-0"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 300 }}
      >
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg ${
          message.sender === "user" 
            ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white" 
            : "bg-gradient-to-r from-gray-100 to-gray-200 text-gray-600 border-2 border-white"
        }`}>
          {message.sender === "user" ? (
            <User className="w-5 h-5" />
          ) : (
            <Bot className="w-5 h-5" />
          )}
        </div>
      </motion.div>

      {/* Message Content */}
      <div className={`flex flex-col max-w-[80%] md:max-w-[85%] ${
        message.sender === "user" ? "items-end" : "items-start"
      }`}>
        <div className={`p-4 rounded-3xl break-words shadow-lg hover:shadow-xl transition-all duration-300 max-w-none ${
          message.sender === "user" 
            ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-br-lg" 
            : "bg-white text-gray-800 border border-gray-100 rounded-bl-lg"
        }`}>
          {message.sender === 'bot' ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-gray-900 prose-p:text-gray-800 prose-strong:text-gray-900"
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '')
                  const codeString = String(children).replace(/\n$/, '')
                  
                  return !inline && match ? (
                    <div className="relative group my-4">
                      <button
                        onClick={() => copyToClipboard(codeString)}
                        className="absolute right-2 top-2 p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white opacity-0 group-hover:opacity-100 transition-all duration-200 z-10"
                        title="Copy code"
                      >
                        {copiedCode === codeString ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <SyntaxHighlighter
                        style={theme === 'dark' ? oneDark : oneLight}
                        language={match[1]}
                        PreTag="div"
                        className="rounded-xl !mt-2 !mb-2 shadow-lg"
                        {...props}
                      >
                        {codeString}
                      </SyntaxHighlighter>
                    </div>
                  ) : (
                    <code 
                      className={`${className} bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-lg text-sm font-mono`} 
                      {...props}
                    >
                      {children}
                    </code>
                  )
                },
                pre({ children }) {
                  return <div className="overflow-x-auto">{children}</div>
                },
                table({ children }) {
                  return (
                    <div className="overflow-x-auto my-4">
                      <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600 rounded-lg">
                        {children}
                      </table>
                    </div>
                  )
                },
                th({ children }) {
                  return (
                    <th className="border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-3 text-left font-semibold">
                      {children}
                    </th>
                  )
                },
                td({ children }) {
                  return (
                    <td className="border border-gray-300 dark:border-gray-600 px-4 py-3">
                      {children}
                    </td>
                  )
                },
                blockquote({ children }) {
                  return (
                    <blockquote className="border-l-4 border-blue-500 pl-4 py-2 my-4 bg-blue-50 dark:bg-gray-700 italic rounded-r-lg">
                      {children}
                    </blockquote>
                  )
                },
                a({ href, children }) {
                  return (
                    <a 
                      href={href} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                    >
                      {children}
                    </a>
                  )
                },
                h1({ children }) {
                  return <h1 className="text-2xl font-bold mt-6 mb-3 text-gray-900 dark:text-gray-100">{children}</h1>
                },
                h2({ children }) {
                  return <h2 className="text-xl font-bold mt-5 mb-3 text-gray-900 dark:text-gray-100">{children}</h2>
                },
                h3({ children }) {
                  return <h3 className="text-lg font-bold mt-4 mb-2 text-gray-900 dark:text-gray-100">{children}</h3>
                },
                ul({ children }) {
                  return <ul className="list-disc list-inside my-3 space-y-2 pl-2">{children}</ul>
                },
                ol({ children }) {
                  return <ol className="list-decimal list-inside my-3 space-y-2 pl-2">{children}</ol>
                },
                li({ children }) {
                  return <li className="text-gray-800 dark:text-gray-200 leading-relaxed">{children}</li>
                },
                p({ children }) {
                  return <p className="mb-3 leading-relaxed text-gray-800 dark:text-gray-200">{children}</p>
                },
                strong({ children }) {
                  return <strong className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>
                },
                em({ children }) {
                  return <em className="italic text-gray-700 dark:text-gray-300">{children}</em>
                }
              }}
            >
              {message.text}
            </ReactMarkdown>
          ) : (
            <span className="whitespace-pre-wrap leading-relaxed">{message.text}</span>
          )}
        </div>
        
        {/* Timestamp */}
        <div className={`text-xs opacity-70 mt-2 px-2 ${
          message.sender === "user" ? "text-gray-600" : "text-gray-500"
        }`}>
          {message.timestamp}
        </div>
      </div>
    </motion.div>
  )
}