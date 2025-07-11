import { Bot } from "lucide-react"
import { motion } from "framer-motion"

export function TypingIndicator() {
  return (
    <motion.div 
      className="mb-6 flex gap-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      {/* Bot Avatar */}
      <motion.div 
        className="flex-shrink-0"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 300 }}
      >
        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-r from-gray-100 to-gray-200 text-gray-600 border-2 border-white shadow-lg">
          <Bot className="w-5 h-5" />
        </div>
      </motion.div>

      {/* Typing Animation */}
      <div className="flex flex-col items-start">
        <motion.div 
          className="p-4 rounded-3xl rounded-bl-lg bg-white border border-gray-100 shadow-lg flex items-center gap-2"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex gap-1">
            <motion.div 
              className="w-2 h-2 bg-gray-400 rounded-full"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
            />
            <motion.div 
              className="w-2 h-2 bg-gray-400 rounded-full"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
            />
            <motion.div 
              className="w-2 h-2 bg-gray-400 rounded-full"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
            />
          </div>
          <span className="text-sm text-gray-500 ml-2">Thinking...</span>
        </motion.div>
      </div>
    </motion.div>
  )
}