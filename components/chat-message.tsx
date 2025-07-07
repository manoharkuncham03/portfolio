'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check } from 'lucide-react'
import { useTheme } from 'next-themes'

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
    <div className={`mb-4 flex gap-3 ${message.sender === "user" ? "flex-row-reverse" : "flex-row"}`}>
      {/* Profile Icon */}
      <div className="flex-shrink-0">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium">
          {message.sender === "user" ? (
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white">👤</div>
          ) : (
            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300">🤖</div>
          )}
        </div>
      </div>

      {/* Message Content */}
      <div
        className={`flex flex-col max-w-[80%] md:max-w-[85%] ${message.sender === "user" ? "items-end" : "items-start"}`}
      >
        <div
          className={`p-3 rounded-xl break-words hover:shadow-md transition-shadow duration-200 ${
            message.sender === "user" 
              ? "bg-blue-500 text-white" 
              : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700"
          }`}
        >
          {message.sender === 'bot' ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              className="prose prose-sm max-w-none dark:prose-invert"
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '')
                  const codeString = String(children).replace(/\n$/, '')
                  
                  return !inline && match ? (
                    <div className="relative group">
                      <button
                        onClick={() => copyToClipboard(codeString)}
                        className="absolute right-2 top-2 p-1.5 rounded bg-gray-800 hover:bg-gray-700 text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        title="Copy code"
                      >
                        {copiedCode === codeString ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                      <SyntaxHighlighter
                        style={theme === 'dark' ? oneDark : oneLight}
                        language={match[1]}
                        PreTag="div"
                        className="rounded-md !mt-2 !mb-2"
                        {...props}
                      >
                        {codeString}
                      </SyntaxHighlighter>
                    </div>
                  ) : (
                    <code 
                      className={`${className} bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-sm font-mono`} 
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
                      <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600">
                        {children}
                      </table>
                    </div>
                  )
                },
                th({ children }) {
                  return (
                    <th className="border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-2 text-left font-semibold">
                      {children}
                    </th>
                  )
                },
                td({ children }) {
                  return (
                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">
                      {children}
                    </td>
                  )
                },
                blockquote({ children }) {
                  return (
                    <blockquote className="border-l-4 border-blue-500 pl-4 py-2 my-4 bg-gray-50 dark:bg-gray-700 italic">
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
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {children}
                    </a>
                  )
                },
                h1({ children }) {
                  return <h1 className="text-xl font-bold mt-4 mb-2 text-gray-900 dark:text-gray-100">{children}</h1>
                },
                h2({ children }) {
                  return <h2 className="text-lg font-bold mt-3 mb-2 text-gray-900 dark:text-gray-100">{children}</h2>
                },
                h3({ children }) {
                  return <h3 className="text-base font-bold mt-2 mb-1 text-gray-900 dark:text-gray-100">{children}</h3>
                },
                ul({ children }) {
                  return <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>
                },
                ol({ children }) {
                  return <ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>
                },
                li({ children }) {
                  return <li className="text-gray-800 dark:text-gray-200">{children}</li>
                },
                p({ children }) {
                  return <p className="mb-2 leading-relaxed text-gray-800 dark:text-gray-200">{children}</p>
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
            <span className="whitespace-pre-wrap">{message.text}</span>
          )}
        </div>
        <div className="text-xs opacity-70 mt-1 text-gray-500 dark:text-gray-400">{message.timestamp}</div>
      </div>
    </div>
  )
}