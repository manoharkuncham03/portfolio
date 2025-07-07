"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Search, 
  X, 
  Calendar,
  Trash2,
  Download,
  Plus,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Clock,
  Filter,
  Archive,
  Star,
  MoreVertical,
  Edit2
} from "lucide-react"

interface Message {
  id: string
  text: string
  sender: "user" | "bot"
  timestamp: string
}

interface Conversation {
  id: string
  title: string
  lastMessage: string
  timestamp: string
  messages: Message[]
  isStarred?: boolean
  isArchived?: boolean
  tags?: string[]
}

interface ConversationGroup {
  date: string
  conversations: Conversation[]
}

interface ConversationSidebarProps {
  conversations: Conversation[]
  currentConversationId?: string
  isOpen: boolean
  onClose: () => void
  onSelectConversation: (conversation: Conversation) => void
  onCreateConversation: () => void
  onDeleteConversation: (conversationId: string) => void
  onUpdateConversation: (conversationId: string, updates: Partial<Conversation>) => void
  onExportConversations: (conversationIds: string[]) => void
  className?: string
}

export default function ConversationSidebar({
  conversations,
  currentConversationId,
  isOpen,
  onClose,
  onSelectConversation,
  onCreateConversation,
  onDeleteConversation,
  onUpdateConversation,
  onExportConversations,
  className = ""
}: ConversationSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedConversations, setSelectedConversations] = useState<Set<string>>(new Set())
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [filterType, setFilterType] = useState<"all" | "starred" | "archived">("all")
  const [editingConversation, setEditingConversation] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)

  // Initialize expanded groups to show today and yesterday by default
  useEffect(() => {
    const today = new Date().toDateString()
    const yesterday = new Date(Date.now() - 86400000).toDateString()
    setExpandedGroups(new Set([today, yesterday]))
  }, [])

  // Filter and search conversations
  const filteredConversations = useMemo(() => {
    let filtered = conversations

    // Apply filter type
    switch (filterType) {
      case "starred":
        filtered = filtered.filter(conv => conv.isStarred)
        break
      case "archived":
        filtered = filtered.filter(conv => conv.isArchived)
        break
      default:
        filtered = filtered.filter(conv => !conv.isArchived)
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(conv => 
        conv.title.toLowerCase().includes(query) ||
        conv.lastMessage.toLowerCase().includes(query) ||
        conv.messages.some(msg => msg.text.toLowerCase().includes(query)) ||
        conv.tags?.some(tag => tag.toLowerCase().includes(query))
      )
    }

    return filtered
  }, [conversations, searchQuery, filterType])

  // Group conversations by date
  const groupedConversations = useMemo(() => {
    const groups: { [key: string]: Conversation[] } = {}
    
    filteredConversations.forEach(conv => {
      const date = new Date(conv.timestamp).toDateString()
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(conv)
    })

    // Sort groups by date (newest first)
    const sortedGroups = Object.entries(groups)
      .map(([date, convs]) => ({
        date,
        conversations: convs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return sortedGroups
  }, [filteredConversations])

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today.getTime() - 86400000)
    
    if (date.toDateString() === today.toDateString()) {
      return "Today"
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday"
    } else if (date.getFullYear() === today.getFullYear()) {
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    } else {
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    }
  }

  // Toggle group expansion
  const toggleGroup = (date: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(date)) {
        newSet.delete(date)
      } else {
        newSet.add(date)
      }
      return newSet
    })
  }

  // Handle conversation selection
  const handleSelectConversation = (conversation: Conversation) => {
    if (selectedConversations.size > 0) {
      // Multi-select mode
      toggleConversationSelection(conversation.id)
    } else {
      // Normal selection
      onSelectConversation(conversation)
      if (window.innerWidth < 768) {
        onClose()
      }
    }
  }

  // Toggle conversation selection for multi-select
  const toggleConversationSelection = (conversationId: string) => {
    setSelectedConversations(prev => {
      const newSet = new Set(prev)
      if (newSet.has(conversationId)) {
        newSet.delete(conversationId)
      } else {
        newSet.add(conversationId)
      }
      return newSet
    })
  }

  // Clear selection
  const clearSelection = () => {
    setSelectedConversations(new Set())
  }

  // Handle bulk actions
  const handleBulkDelete = () => {
    selectedConversations.forEach(id => onDeleteConversation(id))
    clearSelection()
  }

  const handleBulkExport = () => {
    onExportConversations(Array.from(selectedConversations))
    clearSelection()
  }

  const handleBulkArchive = () => {
    selectedConversations.forEach(id => 
      onUpdateConversation(id, { isArchived: true })
    )
    clearSelection()
  }

  // Handle conversation editing
  const startEditing = (conversation: Conversation) => {
    setEditingConversation(conversation.id)
    setEditTitle(conversation.title)
  }

  const saveEdit = () => {
    if (editingConversation && editTitle.trim()) {
      onUpdateConversation(editingConversation, { title: editTitle.trim() })
    }
    setEditingConversation(null)
    setEditTitle("")
  }

  const cancelEdit = () => {
    setEditingConversation(null)
    setEditTitle("")
  }

  // Toggle star
  const toggleStar = (conversationId: string, isStarred: boolean) => {
    onUpdateConversation(conversationId, { isStarred: !isStarred })
  }

  // Infinite scroll handling
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    
    if (scrollHeight - scrollTop === clientHeight && hasMore && !isLoading) {
      setIsLoading(true)
      // Simulate loading more conversations
      setTimeout(() => {
        setPage(prev => prev + 1)
        setIsLoading(false)
      }, 1000)
    }
  }, [hasMore, isLoading])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      if (e.key === "Escape") {
        if (selectedConversations.size > 0) {
          clearSelection()
        } else {
          onClose()
        }
      } else if (e.key === "Enter" && editingConversation) {
        saveEdit()
      } else if (e.key === "Escape" && editingConversation) {
        cancelEdit()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, selectedConversations.size, editingConversation, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop for mobile */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={onClose}
          />

          {/* Sidebar */}
          <motion.div
            initial={{ x: -400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -400, opacity: 0 }}
            transition={{ 
              type: "spring", 
              damping: 25, 
              stiffness: 200,
              opacity: { duration: 0.2 }
            }}
            className={`fixed inset-y-0 left-0 z-50 w-80 bg-card border-r border-border shadow-xl lg:relative lg:translate-x-0 ${className}`}
          >
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center space-x-2">
                  <MessageSquare className="w-5 h-5" />
                  <h2 className="text-lg font-semibold">Conversations</h2>
                  {conversations.length > 0 && (
                    <span className="text-sm text-muted-foreground">
                      ({filteredConversations.length})
                    </span>
                  )}
                </div>
                
                <div className="flex items-center space-x-1">
                  <button
                    onClick={onCreateConversation}
                    className="p-1.5 rounded-md hover:bg-accent transition-colors"
                    title="New conversation"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-md hover:bg-accent transition-colors lg:hidden"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Search and Filters */}
              <div className="p-4 space-y-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search conversations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 p-0.5 rounded hover:bg-accent"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Filter Tabs */}
                <div className="flex space-x-1 bg-muted rounded-md p-1">
                  {[
                    { key: "all", label: "All", icon: MessageSquare },
                    { key: "starred", label: "Starred", icon: Star },
                    { key: "archived", label: "Archived", icon: Archive }
                  ].map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => setFilterType(key as any)}
                      className={`flex items-center space-x-1 px-2 py-1.5 rounded text-xs transition-all ${
                        filterType === key
                          ? "bg-background shadow-sm"
                          : "hover:bg-background/50"
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      <span className="hidden sm:inline">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bulk Actions */}
              <AnimatePresence>
                {selectedConversations.size > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-4 pb-3 border-b border-border"
                  >
                    <div className="flex items-center justify-between bg-accent rounded-md p-2">
                      <span className="text-sm">
                        {selectedConversations.size} selected
                      </span>
                      <div className="flex space-x-1">
                        <button
                          onClick={handleBulkExport}
                          className="p-1.5 rounded hover:bg-background/50 transition-colors"
                          title="Export selected"
                        >
                          <Download className="w-3 h-3" />
                        </button>
                        <button
                          onClick={handleBulkArchive}
                          className="p-1.5 rounded hover:bg-background/50 transition-colors"
                          title="Archive selected"
                        >
                          <Archive className="w-3 h-3" />
                        </button>
                        <button
                          onClick={handleBulkDelete}
                          className="p-1.5 rounded hover:bg-destructive hover:text-destructive-foreground transition-colors"
                          title="Delete selected"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={clearSelection}
                          className="p-1.5 rounded hover:bg-background/50 transition-colors"
                          title="Clear selection"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Conversations List */}
              <div className="flex-1 overflow-y-auto" onScroll={handleScroll}>
                {groupedConversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                    <MessageSquare className="w-12 h-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No conversations yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Start a new conversation to see it here
                    </p>
                    <button
                      onClick={onCreateConversation}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                    >
                      Start Conversation
                    </button>
                  </div>
                ) : (
                  <div className="p-2 space-y-2">
                    {groupedConversations.map((group) => (
                      <div key={group.date}>
                        {/* Date Group Header */}
                        <button
                          onClick={() => toggleGroup(group.date)}
                          className="flex items-center space-x-2 w-full p-2 text-left text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {expandedGroups.has(group.date) ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(group.date)}</span>
                          <span className="text-xs">({group.conversations.length})</span>
                        </button>

                        {/* Conversations in Group */}
                        <AnimatePresence>
                          {expandedGroups.has(group.date) && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="ml-6 space-y-1"
                            >
                              {group.conversations.map((conversation) => (
                                <motion.div
                                  key={conversation.id}
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -20 }}
                                  className="group relative"
                                >
                                  <button
                                    onClick={() => handleSelectConversation(conversation)}
                                    onDoubleClick={() => startEditing(conversation)}
                                    className={`w-full p-3 text-left rounded-md transition-all ${
                                      currentConversationId === conversation.id
                                        ? 'bg-accent border-l-2 border-primary'
                                        : selectedConversations.has(conversation.id)
                                        ? 'bg-accent/50'
                                        : 'hover:bg-accent/50'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1 min-w-0">
                                        {editingConversation === conversation.id ? (
                                          <input
                                            type="text"
                                            value={editTitle}
                                            onChange={(e) => setEditTitle(e.target.value)}
                                            onBlur={saveEdit}
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter") saveEdit()
                                              if (e.key === "Escape") cancelEdit()
                                            }}
                                            className="w-full bg-transparent font-medium text-sm border-b border-border focus:outline-none focus:border-primary"
                                            autoFocus
                                          />
                                        ) : (
                                          <div className="font-medium text-sm truncate">
                                            {conversation.title}
                                          </div>
                                        )}
                                        
                                        <div className="text-xs text-muted-foreground truncate mt-1">
                                          {conversation.lastMessage}
                                        </div>
                                        
                                        <div className="flex items-center space-x-2 mt-2">
                                          <Clock className="w-3 h-3 text-muted-foreground" />
                                          <span className="text-xs text-muted-foreground">
                                            {new Date(conversation.timestamp).toLocaleTimeString('en-US', {
                                              hour: 'numeric',
                                              minute: '2-digit',
                                              hour12: true
                                            })}
                                          </span>
                                          
                                          {conversation.isStarred && (
                                            <Star className="w-3 h-3 text-yellow-500 fill-current" />
                                          )}
                                          
                                          {conversation.tags && conversation.tags.length > 0 && (
                                            <div className="flex space-x-1">
                                              {conversation.tags.slice(0, 2).map((tag) => (
                                                <span
                                                  key={tag}
                                                  className="px-1.5 py-0.5 bg-secondary text-secondary-foreground text-xs rounded"
                                                >
                                                  {tag}
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      
                                      {selectedConversations.has(conversation.id) && (
                                        <div className="w-4 h-4 bg-primary rounded-full flex items-center justify-center ml-2">
                                          <div className="w-2 h-2 bg-primary-foreground rounded-full" />
                                        </div>
                                      )}
                                    </div>
                                  </button>

                                  {/* Conversation Actions */}
                                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="flex space-x-1">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          toggleStar(conversation.id, !!conversation.isStarred)
                                        }}
                                        className="p-1 rounded hover:bg-background/50 transition-colors"
                                        title={conversation.isStarred ? "Unstar" : "Star"}
                                      >
                                        <Star className={`w-3 h-3 ${conversation.isStarred ? 'text-yellow-500 fill-current' : 'text-muted-foreground'}`} />
                                      </button>
                                      
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          startEditing(conversation)
                                        }}
                                        className="p-1 rounded hover:bg-background/50 transition-colors"
                                        title="Edit title"
                                      >
                                        <Edit2 className="w-3 h-3 text-muted-foreground" />
                                      </button>
                                      
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          onExportConversations([conversation.id])
                                        }}
                                        className="p-1 rounded hover:bg-background/50 transition-colors"
                                        title="Export"
                                      >
                                        <Download className="w-3 h-3 text-muted-foreground" />
                                      </button>
                                      
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          onDeleteConversation(conversation.id)
                                        }}
                                        className="p-1 rounded hover:bg-destructive hover:text-destructive-foreground transition-colors"
                                        title="Delete"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                </motion.div>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}

                    {/* Loading indicator for infinite scroll */}
                    {isLoading && (
                      <div className="flex items-center justify-center p-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-border">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{conversations.length} total conversations</span>
                  <button
                    onClick={() => onExportConversations(conversations.map(c => c.id))}
                    className="flex items-center space-x-1 hover:text-foreground transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    <span>Export All</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export { ConversationSidebar }
