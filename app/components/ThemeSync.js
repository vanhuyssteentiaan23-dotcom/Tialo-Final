'use client'

import { useEffect } from 'react'

const THEMES = ['tialo-neon', 'ai-default', 'midnight', 'emerald', 'sunset']

export default function ThemeSync() {
  useEffect(() => {
    const apply = (value) => {
      const theme = THEMES.includes(value) ? value : 'tialo-neon'
      document.documentElement.dataset.tialoTheme = theme
      document.documentElement.classList.remove(
        'tialo-neon',
        'tialo-ai-default',
        'tialo-midnight',
        'tialo-emerald',
        'tialo-sunset'
      )
      document.documentElement.classList.add(theme)
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
