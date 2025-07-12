"use client"

import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sun, Moon, Monitor } from "lucide-react"

interface DarkModeToggleProps {
  className?: string
  size?: "sm" | "md" | "lg"
  showLabel?: boolean
}

export function DarkModeToggle({
  className = "",
  size = "md",
  showLabel = false
}: DarkModeToggleProps) {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system")
  const [mounted, setMounted] = useState(false)
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">("light")

  // Ensure component is mounted to avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
    
    // Get stored theme preference or default to system
    const storedTheme = localStorage.getItem("theme") as "light" | "dark" | "system" || "system"
    setTheme(storedTheme)
    
    // Detect system theme
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    setSystemTheme(mediaQuery.matches ? "dark" : "light")
    
    // Listen for system theme changes
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light")
    }
    
    mediaQuery.addEventListener("change", handleSystemThemeChange)
    
    // Apply initial theme
    applyTheme(storedTheme, mediaQuery.matches ? "dark" : "light")
    
    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange)
    }
  }, [])

  // Apply theme whenever theme or systemTheme changes
  useEffect(() => {
    if (mounted) {
      applyTheme(theme, systemTheme)
    }
  }, [theme, systemTheme, mounted])

  const applyTheme = (selectedTheme: "light" | "dark" | "system", detectedSystemTheme: "light" | "dark") => {
    const root = document.documentElement
    
    // Remove existing theme classes
    root.classList.remove("light", "dark")
    
    // Apply theme based on selection
    if (selectedTheme === "system") {
      root.classList.add(detectedSystemTheme)
      root.removeAttribute("data-theme")
    } else {
      root.classList.add(selectedTheme)
      root.setAttribute("data-theme", selectedTheme)
    }
    
    // Store preference
    localStorage.setItem("theme", selectedTheme)
  }

  const cycleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light"
    setTheme(nextTheme)
  }

  const getCurrentIcon = () => {
    if (theme === "system") {
      return systemTheme === "dark" ? Moon : Sun
    }
    return theme === "dark" ? Moon : Sun
  }

  const getThemeLabel = () => {
    if (theme === "system") {
      return `System (${systemTheme})`
    }
    return theme.charAt(0).toUpperCase() + theme.slice(1)
  }

  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12"
  }

  const iconSizes = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6"
  }

  if (!mounted) {
    return (
      <div className={`${sizeClasses[size]} rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse ${className}`} />
    )
  }

  const IconComponent = getCurrentIcon()

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <motion.button
        onClick={cycleTheme}
        className={`
          ${sizeClasses[size]} 
          rounded-full 
          bg-white/90 dark:bg-gray-800/90 
          border-2 border-gray-200 dark:border-gray-600
          backdrop-blur-sm 
          shadow-lg hover:shadow-xl 
          transition-all duration-200 
          flex items-center justify-center
          hover:scale-105 active:scale-95
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        `}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label={`Switch theme. Current: ${getThemeLabel()}`}
        title={`Switch theme (Current: ${getThemeLabel()})`}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={`${theme}-${systemTheme}`}
            initial={{ scale: 0, rotate: -180, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0, rotate: 180, opacity: 0 }}
            transition={{
              duration: 0.3,
              ease: "easeInOut"
            }}
            className="relative"
          >
            <IconComponent className={`${iconSizes[size]} text-gray-700 dark:text-gray-200`} />
            
            {/* System indicator */}
            {theme === "system" && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -bottom-1 -right-1 w-2 h-2 bg-blue-500 rounded-full border border-white dark:border-gray-800"
              />
            )}
          </motion.div>
        </AnimatePresence>
      </motion.button>
      
      {showLabel && (
        <motion.span
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-sm font-medium text-gray-700 dark:text-gray-200"
        >
          {getThemeLabel()}
        </motion.span>
      )}
    </div>
  )
}

// Hook for programmatic theme management
export function useDarkMode() {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system")
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">("light")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const storedTheme = localStorage.getItem("theme") as "light" | "dark" | "system" || "system"
    setTheme(storedTheme)
    
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    setSystemTheme(mediaQuery.matches ? "dark" : "light")
    
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light")
    }
    
    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [])

  const resolvedTheme = theme === "system" ? systemTheme : theme

  const setThemeWithStorage = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme)
    localStorage.setItem("theme", newTheme)
    
    const root = document.documentElement
    root.classList.remove("light", "dark")
    
    if (newTheme === "system") {
      root.classList.add(systemTheme)
      root.removeAttribute("data-theme")
    } else {
      root.classList.add(newTheme)
      root.setAttribute("data-theme", newTheme)
    }
  }

  return {
    theme,
    systemTheme,
    resolvedTheme,
    setTheme: setThemeWithStorage,
    mounted,
    isDark: resolvedTheme === "dark",
    isLight: resolvedTheme === "light",
    isSystem: theme === "system"
  }
}

export default DarkModeToggle