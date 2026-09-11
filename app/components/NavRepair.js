'use client'

import { useEffect } from 'react'

const routes = {
  'Daily Tasks': '/daily-tasks',
  'Progress': '/progress',
}

export default function NavRepair() {
  useEffect(() => {
    function repairLinks() {
      document.querySelectorAll('a[href="#"]').forEach(link => {
        const label = link.textContent?.replace(/[^a-zA-Z ]/g, '').trim()
        const route = routes[label]
        if (route) link.setAttribute('href', route)
      })
    }
    repairLinks()
    const observer = new MutationObserver(repairLinks)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return null
}
