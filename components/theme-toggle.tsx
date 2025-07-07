"use client"

import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useTheme } from "next-themes"
import { Sun, Moon, Monitor } from "lucide-react"

interface ThemeToggleProps {
  className?: string
  size?: "sm" | "md" | "lg"
  showSystemOption?: boolean
  animated?: boolean
}

export function ThemeToggle({
  className = "",
  size = "md",
  showSystemOption = true,
  animated = true
}: ThemeToggleProps) {
  const { theme, setTheme, systemTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  // Ensure component is mounted to avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return

      switch (event.key) {
        case "Escape":
          setIsOpen(false)
          break
        case "ArrowDown":
        case "ArrowUp":
          event.preventDefault()
          break
        case "Enter":
        case " ":
          event.preventDefault()
          break
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest("[data-theme-toggle]")) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("click", handleClickOutside)
      return () => document.removeEventListener("click", handleClickOutside)
    }
  }, [isOpen])

  if (!mounted) {
    return (
      <button
        className={`p-2 rounded-md hover:bg-accent transition-colors ${className}`}
        disabled
        aria-label="Loading theme toggle"
      >
        <div className="w-5 h-5 animate-pulse bg-muted rounded" />
      </button>
    )
  }

  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6"
  }

  const buttonSizeClasses = {
    sm: "p-1.5",
    md: "p-2",
    lg: "p-2.5"
  }

  const getCurrentIcon = () => {
    if (theme === "system") {
      return resolvedTheme === "dark" ? Moon : Sun
    }
    return theme === "dark" ? Moon : Sun
  }

  const IconComponent = getCurrentIcon()

  const themeOptions = [
    {
      value: "light",
      label: "Light",
      icon: Sun,
      description: "Light mode"
    },
    {
      value: "dark",
      label: "Dark",
      icon: Moon,
      description: "Dark mode"
    },
    ...(showSystemOption ? [{
      value: "system",
      label: "System",
      icon: Monitor,
      description: "Follow system preference"
    }] : [])
  ]

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme)
    setIsOpen(false)
  }

  const toggleTheme = () => {
    if (showSystemOption) {
      // Cycle through light -> dark -> system
      if (theme === "light") {
        setTheme("dark")
      } else if (theme === "dark") {
        setTheme("system")
      } else {
        setTheme("light")
      }
    } else {
      // Simple toggle between light and dark
      setTheme(theme === "dark" ? "light" : "dark")
    }
  }

  if (!showSystemOption) {
    // Simple toggle button
    return (
      <button
        onClick={toggleTheme}
        className={`${buttonSizeClasses[size]} rounded-md hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${className}`}
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      >
        <AnimatePresence mode="wait" initial={false}>
          {animated ? (
            <motion.div
              key={theme}
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              transition={{
                duration: 0.2,
                ease: "easeInOut"
              }}
            >
              <IconComponent className={sizeClasses[size]} />
            </motion.div>
          ) : (
            <IconComponent className={sizeClasses[size]} />
          )}
        </AnimatePresence>
      </button>
    )
  }

  // Dropdown version with system option
  return (
    <div className="relative" data-theme-toggle>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`${buttonSizeClasses[size]} rounded-md hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${className}`}
        aria-label="Toggle theme"
        aria-expanded={isOpen}
        aria-haspopup="true"
        title="Change theme"
      >
        <AnimatePresence mode="wait" initial={false}>
          {animated ? (
            <motion.div
              key={`${theme}-${resolvedTheme}`}
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              transition={{
                duration: 0.2,
                ease: "easeInOut"
              }}
            >
              <IconComponent className={sizeClasses[size]} />
            </motion.div>
          ) : (
            <IconComponent className={sizeClasses[size]} />
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.1 }}
            className="absolute right-0 mt-2 w-48 bg-popover border border-border rounded-md shadow-lg z-50"
            role="menu"
            aria-orientation="vertical"
            aria-labelledby="theme-menu"
          >
            <div className="py-1">
              {themeOptions.map((option) => {
                const OptionIcon = option.icon
                const isSelected = theme === option.value
                
                return (
                  <button
                    key={option.value}
                    onClick={() => handleThemeChange(option.value)}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors focus:outline-none focus:bg-accent ${
                      isSelected ? "bg-accent" : ""
                    }`}
                    role="menuitem"
                    aria-label={option.description}
                  >
                    <div className="flex items-center space-x-3">
                      <motion.div
                        animate={animated ? {
                          scale: isSelected ? 1.1 : 1,
                          rotate: isSelected ? 360 : 0
                        } : {}}
                        transition={{ duration: 0.2 }}
                      >
                        <OptionIcon className="w-4 h-4" />
                      </motion.div>
                      <span className="flex-1">{option.label}</span>
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-2 h-2 bg-primary rounded-full"
                        />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Compound component for inline theme switching
export function ThemeToggleInline({
  className = "",
  animated = true
}: {
  className?: string
  animated?: boolean
}) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="w-20 h-8 bg-muted animate-pulse rounded" />
  }

  const options = [
    { value: "light", icon: Sun, label: "Light" },
    { value: "dark", icon: Moon, label: "Dark" },
    { value: "system", icon: Monitor, label: "System" }
  ]

  return (
    <div className={`flex bg-muted rounded-md p-1 ${className}`}>
      {options.map((option) => {
        const OptionIcon = option.icon
        const isSelected = theme === option.value
        
        return (
          <button
            key={option.value}
            onClick={() => setTheme(option.value)}
            className={`flex items-center space-x-1 px-2 py-1 rounded text-sm transition-all duration-200 ${
              isSelected
                ? "bg-background shadow-sm"
                : "hover:bg-background/50"
            }`}
            aria-label={`Switch to ${option.label.toLowerCase()} mode`}
            title={`Switch to ${option.label.toLowerCase()} mode`}
          >
            <motion.div
              animate={animated ? {
                scale: isSelected ? 1.1 : 1,
                rotate: isSelected ? 360 : 0
              } : {}}
              transition={{ duration: 0.2 }}
            >
              <OptionIcon className="w-4 h-4" />
            </motion.div>
            <span className="hidden sm:inline">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// Hook for programmatic theme management
export function useThemeToggle() {
  const { theme, setTheme, systemTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    if (theme === "light") {
      setTheme("dark")
    } else if (theme === "dark") {
      setTheme("system")
    } else {
      setTheme("light")
    }
  }

  const setLightTheme = () => setTheme("light")
  const setDarkTheme = () => setTheme("dark")
  const setSystemTheme = () => setTheme("system")

  return {
    theme,
    setTheme,
    systemTheme,
    resolvedTheme,
    mounted,
    toggleTheme,
    setLightTheme,
    setDarkTheme,
    setSystemTheme,
    isDark: resolvedTheme === "dark",
    isLight: resolvedTheme === "light",
    isSystem: theme === "system"
  }
}

export default ThemeToggle
