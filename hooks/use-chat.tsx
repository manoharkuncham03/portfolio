"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useTheme } from "next-themes"

interface Message {
  id: string
  text: string
  sender: "user" | "bot"
  timestamp: string
  isStreaming?: boolean
  isError?: boolean
  retryCount?: number
  sessionId?: string
}

interface Conversation {
  id: string
  title: string
  messages: Message[]
  lastMessage: string
  timestamp: string
  isStarred?: boolean
  isArchived?: boolean
  tags?: string[]
}

interface ChatSession {
  id: string
  conversationId: string
  isActive: boolean
  lastActivity: string
  metadata?: Record<string, any>
}

interface UseChatOptions {
  maxRetries?: number
  retryDelay?: number
  enablePersistence?: boolean
  enableOfflineSupport?: boolean
  debounceDelay?: number
  maxMessages?: number
  streamingEnabled?: boolean
  apiEndpoint?: string
  onError?: (error: Error, message: Message) => void
  onMessageReceived?: (message: Message) => void
  onTypingStart?: () => void
  onTypingEnd?: () => void
}

interface ChatState {
  messages: Message[]
  conversations: Conversation[]
  currentConversation: Conversation | null
  currentSession: ChatSession | null
  isLoading: boolean
  isTyping: boolean
  isConnected: boolean
  isStreaming: boolean
  error: string | null
  retryQueue: Message[]
}

interface ChatActions {
  sendMessage: (text: string, options?: { conversationId?: string; sessionId?: string }) => Promise<void>
  resendMessage: (messageId: string) => Promise<void>
  clearMessages: () => void
  clearError: () => void
  createConversation: (title?: string) => Conversation
  switchConversation: (conversationId: string) => void
  deleteConversation: (conversationId: string) => void
  updateConversation: (conversationId: string, updates: Partial<Conversation>) => void
  exportConversation: (conversationId: string) => string
  importConversation: (data: string) => boolean
  startTyping: () => void
  stopTyping: () => void
  retry: (messageId?: string) => Promise<void>
  cancelStreaming: () => void
}

interface UseChatReturn extends ChatState, ChatActions {
  input: string
  setInput: (value: string) => void
  handleSubmit: (e?: React.FormEvent) => Promise<void>
  isOffline: boolean
  queuedMessages: number
}

// Storage keys
const STORAGE_KEYS = {
  CONVERSATIONS: 'chat_conversations',
  CURRENT_CONVERSATION: 'chat_current_conversation',
  SESSIONS: 'chat_sessions',
  SETTINGS: 'chat_settings'
}

// Cache configuration
const CACHE_CONFIG = {
  MAX_MESSAGES_CACHE: 1000,
  CACHE_DURATION: 24 * 60 * 60 * 1000, // 24 hours
  CLEANUP_INTERVAL: 60 * 60 * 1000 // 1 hour
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    enablePersistence = true,
    enableOfflineSupport = true,
    debounceDelay = 300,
    maxMessages = 1000,
    streamingEnabled = false,
    apiEndpoint = '/api/chat',
    onError,
    onMessageReceived,
    onTypingStart,
    onTypingEnd
  } = options

  // Core state
  const [state, setState] = useState<ChatState>({
    messages: [],
    conversations: [],
    currentConversation: null,
    currentSession: null,
    isLoading: false,
    isTyping: false,
    isConnected: true,
    isStreaming: false,
    error: null,
    retryQueue: []
  })

  const [input, setInput] = useState("")
  const [isOffline, setIsOffline] = useState(false)
  const [messageCache, setMessageCache] = useState<Map<string, Message>>(new Map())

  // References
  const abortControllerRef = useRef<AbortController | null>(null)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const streamReaderRef = useRef<ReadableStreamDefaultReader | null>(null)

  // Memoized values
  const queuedMessages = useMemo(() => 
    state.retryQueue.length
  , [state.retryQueue])

  const currentMessages = useMemo(() => 
    state.currentConversation?.messages || state.messages
  , [state.currentConversation, state.messages])

  // Initialize from storage
  useEffect(() => {
    if (!enablePersistence) return

    try {
      const storedConversations = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS)
      const storedCurrentId = localStorage.getItem(STORAGE_KEYS.CURRENT_CONVERSATION)
      
      if (storedConversations) {
        const conversations = JSON.parse(storedConversations)
        const currentConversation = storedCurrentId 
          ? conversations.find((c: Conversation) => c.id === storedCurrentId)
          : null

        setState(prev => ({
          ...prev,
          conversations,
          currentConversation,
          messages: currentConversation?.messages || []
        }))
      }
    } catch (error) {
      console.warn('Failed to load chat data from storage:', error)
    }
  }, [enablePersistence])

  // Persist to storage
  const persistToStorage = useCallback(() => {
    if (!enablePersistence) return

    try {
      localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(state.conversations))
      if (state.currentConversation) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_CONVERSATION, state.currentConversation.id)
      }
    } catch (error) {
      console.warn('Failed to save chat data to storage:', error)
    }
  }, [state.conversations, state.currentConversation, enablePersistence])

  // Debounced persistence
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    debounceTimeoutRef.current = setTimeout(persistToStorage, debounceDelay)

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [persistToStorage, debounceDelay])

  // Connection status monitoring
  useEffect(() => {
    if (!enableOfflineSupport) return

    const handleOnline = () => {
      setIsOffline(false)
      setState(prev => ({ ...prev, isConnected: true }))
      
      // Process retry queue when back online
      if (state.retryQueue.length > 0) {
        processRetryQueue()
      }
    }

    const handleOffline = () => {
      setIsOffline(true)
      setState(prev => ({ ...prev, isConnected: false }))
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Initial status
    setIsOffline(!navigator.onLine)
    setState(prev => ({ ...prev, isConnected: navigator.onLine }))

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [enableOfflineSupport, state.retryQueue.length])

  // Cache cleanup
  useEffect(() => {
    const cleanup = () => {
      const now = Date.now()
      const newCache = new Map()
      
      messageCache.forEach((message, key) => {
        const messageTime = new Date(message.timestamp).getTime()
        if (now - messageTime < CACHE_CONFIG.CACHE_DURATION) {
          newCache.set(key, message)
        }
      })
      
      setMessageCache(newCache)
    }

    const interval = setInterval(cleanup, CACHE_CONFIG.CLEANUP_INTERVAL)
    return () => clearInterval(interval)
  }, [messageCache])

  // Utility functions
  const getCurrentTime = () => {
    return new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }

  const generateId = () => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  const createMessage = (text: string, sender: "user" | "bot", options: Partial<Message> = {}): Message => ({
    id: generateId(),
    text,
    sender,
    timestamp: getCurrentTime(),
    sessionId: state.currentSession?.id,
    ...options
  })

  // Message management
  const addMessage = useCallback((message: Message) => {
    setState(prev => {
      const newMessages = [...prev.messages, message]
      
      // Limit message history
      const limitedMessages = newMessages.slice(-maxMessages)
      
      // Update current conversation if exists
      const updatedConversation = prev.currentConversation ? {
        ...prev.currentConversation,
        messages: [...prev.currentConversation.messages, message],
        lastMessage: message.text,
        timestamp: new Date().toISOString()
      } : null

      // Update conversations list
      const updatedConversations = updatedConversation
        ? prev.conversations.map(conv => 
            conv.id === updatedConversation.id ? updatedConversation : conv
          )
        : prev.conversations

      // Cache message
      messageCache.set(message.id, message)

      return {
        ...prev,
        messages: limitedMessages,
        currentConversation: updatedConversation,
        conversations: updatedConversations
      }
    })

    onMessageReceived?.(message)
  }, [maxMessages, messageCache, onMessageReceived])

  // Typing indicator management
  const startTyping = useCallback(() => {
    setState(prev => ({ ...prev, isTyping: true }))
    onTypingStart?.()

    // Auto-stop typing after timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping()
    }, 30000) // 30 seconds max
  }, [onTypingStart])

  const stopTyping = useCallback(() => {
    setState(prev => ({ ...prev, isTyping: false }))
    onTypingEnd?.()

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }
  }, [onTypingEnd])

  // Streaming handling
  const handleStreamingResponse = useCallback(async (response: Response, messageId: string) => {
    if (!response.body) return

    const reader = response.body.getReader()
    streamReaderRef.current = reader
    
    setState(prev => ({ ...prev, isStreaming: true }))

    let accumulatedText = ""

    try {
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break

        const chunk = new TextDecoder().decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.content) {
                accumulatedText += data.content
                
                // Update streaming message
                setState(prev => ({
                  ...prev,
                  messages: prev.messages.map(msg =>
                    msg.id === messageId
                      ? { ...msg, text: accumulatedText, isStreaming: true }
                      : msg
                  )
                }))
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      // Mark streaming as complete
      setState(prev => ({
        ...prev,
        messages: prev.messages.map(msg =>
          msg.id === messageId
            ? { ...msg, isStreaming: false }
            : msg
        ),
        isStreaming: false
      }))

    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Streaming error:', error)
        setState(prev => ({ ...prev, isStreaming: false, error: error.message }))
      }
    } finally {
      streamReaderRef.current = null
    }
  }, [])

  // Cancel streaming
  const cancelStreaming = useCallback(() => {
    if (streamReaderRef.current) {
      streamReaderRef.current.cancel()
      streamReaderRef.current = null
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    setState(prev => ({ ...prev, isStreaming: false }))
  }, [])

  // Retry logic
  const retry = useCallback(async (messageId?: string) => {
    const messagesToRetry = messageId 
      ? state.retryQueue.filter(msg => msg.id === messageId)
      : [...state.retryQueue]

    setState(prev => ({
      ...prev,
      retryQueue: messageId 
        ? prev.retryQueue.filter(msg => msg.id !== messageId)
        : []
    }))

    for (const message of messagesToRetry) {
      try {
        await sendMessageInternal(message.text, {
          conversationId: state.currentConversation?.id,
          sessionId: message.sessionId,
          isRetry: true
        })
      } catch (error) {
        console.error('Retry failed for message:', message.id, error)
      }
    }
  }, [state.retryQueue, state.currentConversation])

  // Process retry queue when online
  const processRetryQueue = useCallback(async () => {
    if (state.retryQueue.length === 0 || !state.isConnected) return

    const messages = [...state.retryQueue]
    setState(prev => ({ ...prev, retryQueue: [] }))

    for (const message of messages) {
      try {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        await sendMessageInternal(message.text, {
          conversationId: state.currentConversation?.id,
          sessionId: message.sessionId,
          isRetry: true
        })
      } catch (error) {
        console.error('Failed to process queued message:', error)
        setState(prev => ({
          ...prev,
          retryQueue: [...prev.retryQueue, message]
        }))
      }
    }
  }, [state.retryQueue, state.isConnected, state.currentConversation, retryDelay])

  // Core send message function
  const sendMessageInternal = useCallback(async (
    text: string,
    options: {
      conversationId?: string
      sessionId?: string
      isRetry?: boolean
    } = {}
  ) => {
    const userMessage = createMessage(text, "user", {
      sessionId: options.sessionId,
      retryCount: options.isRetry ? 1 : 0
    })

    // Add user message immediately
    addMessage(userMessage)

    // Handle offline mode
    if (!state.isConnected && enableOfflineSupport) {
      setState(prev => ({
        ...prev,
        retryQueue: [...prev.retryQueue, userMessage]
      }))
      return
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }))
    startTyping()

    // Create abort controller for this request
    abortControllerRef.current = new AbortController()

    try {
      const requestBody = {
        messages: [
          ...currentMessages.map(m => ({
            role: m.sender === "user" ? "user" : "assistant",
            content: m.text,
          })),
          { role: "user", content: text },
        ],
        stream: streamingEnabled,
        conversationId: options.conversationId,
        sessionId: options.sessionId
      }

      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      if (streamingEnabled && response.body) {
        // Create placeholder message for streaming
        const botMessage = createMessage("", "bot", { isStreaming: true })
        addMessage(botMessage)
        await handleStreamingResponse(response, botMessage.id)
      } else {
        // Handle regular response
        const data = await response.json()
        
        if (data.content) {
          const botMessage = createMessage(data.content, "bot")
          addMessage(botMessage)
        } else {
          throw new Error("No content in response")
        }
      }

    } catch (error) {
      if (error.name === 'AbortError') {
        return
      }

      console.error("Error sending message:", error)
      
      const errorMessage = createMessage(
        "Sorry, I encountered an error. Please try again.",
        "bot",
        { isError: true }
      )
      addMessage(errorMessage)

      // Add to retry queue if max retries not reached
      if ((userMessage.retryCount || 0) < maxRetries) {
        setState(prev => ({
          ...prev,
          retryQueue: [...prev.retryQueue, {
            ...userMessage,
            retryCount: (userMessage.retryCount || 0) + 1
          }]
        }))
      }

      setState(prev => ({ ...prev, error: error.message }))
      onError?.(error, userMessage)

    } finally {
      setState(prev => ({ ...prev, isLoading: false }))
      stopTyping()
      abortControllerRef.current = null
    }
  }, [
    state.isConnected,
    state.retryQueue,
    currentMessages,
    streamingEnabled,
    apiEndpoint,
    maxRetries,
    enableOfflineSupport,
    addMessage,
    startTyping,
    stopTyping,
    handleStreamingResponse,
    createMessage,
    onError
  ])

  // Public send message function
  const sendMessage = useCallback(async (
    text: string,
    options: { conversationId?: string; sessionId?: string } = {}
  ) => {
    if (!text.trim()) return
    await sendMessageInternal(text.trim(), options)
  }, [sendMessageInternal])

  // Resend message
  const resendMessage = useCallback(async (messageId: string) => {
    const message = messageCache.get(messageId) || 
      currentMessages.find(m => m.id === messageId)
    
    if (message && message.sender === "user") {
      await sendMessageInternal(message.text, { isRetry: true })
    }
  }, [messageCache, currentMessages, sendMessageInternal])

  // Handle form submit
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim() || state.isLoading) return

    const messageText = input.trim()
    setInput("")
    
    await sendMessage(messageText)
  }, [input, state.isLoading, sendMessage])

  // Conversation management
  const createConversation = useCallback((title?: string): Conversation => {
    const conversation: Conversation = {
      id: generateId(),
      title: title || `Conversation ${state.conversations.length + 1}`,
      messages: [],
      lastMessage: "",
      timestamp: new Date().toISOString()
    }

    setState(prev => ({
      ...prev,
      conversations: [conversation, ...prev.conversations],
      currentConversation: conversation,
      messages: []
    }))

    return conversation
  }, [state.conversations.length])

  const switchConversation = useCallback((conversationId: string) => {
    const conversation = state.conversations.find(c => c.id === conversationId)
    if (conversation) {
      setState(prev => ({
        ...prev,
        currentConversation: conversation,
        messages: conversation.messages
      }))
    }
  }, [state.conversations])

  const deleteConversation = useCallback((conversationId: string) => {
    setState(prev => {
      const updatedConversations = prev.conversations.filter(c => c.id !== conversationId)
      const newCurrentConversation = prev.currentConversation?.id === conversationId
        ? (updatedConversations[0] || null)
        : prev.currentConversation

      return {
        ...prev,
        conversations: updatedConversations,
        currentConversation: newCurrentConversation,
        messages: newCurrentConversation?.messages || []
      }
    })
  }, [])

  const updateConversation = useCallback((conversationId: string, updates: Partial<Conversation>) => {
    setState(prev => {
      const updatedConversations = prev.conversations.map(conv =>
        conv.id === conversationId ? { ...conv, ...updates } : conv
      )
      
      const updatedCurrentConversation = prev.currentConversation?.id === conversationId
        ? { ...prev.currentConversation, ...updates }
        : prev.currentConversation

      return {
        ...prev,
        conversations: updatedConversations,
        currentConversation: updatedCurrentConversation
      }
    })
  }, [])

  // Export/Import
  const exportConversation = useCallback((conversationId: string): string => {
    const conversation = state.conversations.find(c => c.id === conversationId)
    if (!conversation) return ""

    return JSON.stringify({
      ...conversation,
      exportedAt: new Date().toISOString(),
      version: "1.0"
    }, null, 2)
  }, [state.conversations])

  const importConversation = useCallback((data: string): boolean => {
    try {
      const conversation = JSON.parse(data)
      
      // Basic validation
      if (!conversation.id || !conversation.title || !Array.isArray(conversation.messages)) {
        return false
      }

      // Generate new ID to avoid conflicts
      const importedConversation: Conversation = {
        ...conversation,
        id: generateId(),
        timestamp: new Date().toISOString()
      }

      setState(prev => ({
        ...prev,
        conversations: [importedConversation, ...prev.conversations]
      }))

      return true
    } catch (error) {
      console.error('Failed to import conversation:', error)
      return false
    }
  }, [])

  // Clear functions
  const clearMessages = useCallback(() => {
    setState(prev => ({
      ...prev,
      messages: [],
      error: null
    }))

    if (state.currentConversation) {
      updateConversation(state.currentConversation.id, { messages: [] })
    }
  }, [state.currentConversation, updateConversation])

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (streamReaderRef.current) {
        streamReaderRef.current.cancel()
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [])

  return {
    // State
    ...state,
    input,
    isOffline,
    queuedMessages,

    // Actions
    setInput,
    sendMessage,
    resendMessage,
    handleSubmit,
    clearMessages,
    clearError,
    createConversation,
    switchConversation,
    deleteConversation,
    updateConversation,
    exportConversation,
    importConversation,
    startTyping,
    stopTyping,
    retry,
    cancelStreaming
  }
}

export type { Message, Conversation, ChatSession, UseChatOptions, UseChatReturn }
