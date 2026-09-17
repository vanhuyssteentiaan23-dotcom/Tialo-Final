'use client'

import { useEffect } from 'react'

const THEMES = ['tialo-neon', 'ai-default', 'midnight', 'emerald', 'sunset']

function themeClass(value) {
  const theme = THEMES.includes(value) ? value : 'tialo-neon'
  return theme === 'tialo-neon' ? 'tialo-neon' : `tialo-${theme}`
}

export default function ThemeSync() {
  useEffect(() => {
    const classes = [
      'tialo-neon',
      'tialo-ai-default',
      'tialo-midnight',
      'tialo-emerald',
      'tialo-sunset',
    ]

    const apply = (value) => {
      document.documentElement.classList.remove(...classes)
      document.documentElement.classList.add(themeClass(value))
      document.documentElement.dataset.tialoTheme = THEMES.includes(value) ? value : 'tialo-neon'
    }

    apply(window.localStorage.getItem('tialo-color-theme') || 'tialo-neon')

    const handleStorage = (event) => {
      if (event.key === 'tialo-color-theme') apply(event.newValue)
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  return null
}
