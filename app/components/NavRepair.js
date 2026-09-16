'use client'

import { useEffect, useState } from 'react'

const routes = {
  'Daily Tasks': '/daily-tasks',
  'Progress': '/progress',
}

export default function NavRepair() {
  const [dashboard, setDashboard] = useState(false)
  const [aiDefault, setAiDefault] = useState(false)

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

    const isDashboard = window.location.pathname === '/dashboard'
    setDashboard(isDashboard)
    if (isDashboard) {
      const saved = window.localStorage.getItem('tialo-color-theme') === 'ai-default'
      setAiDefault(saved)
      document.documentElement.classList.toggle('tialo-ai-default', saved)
    }

    return () => observer.disconnect()
  }, [])

  function toggleTheme() {
    const next = !aiDefault
    setAiDefault(next)
    document.documentElement.classList.toggle('tialo-ai-default', next)
    window.localStorage.setItem('tialo-color-theme', next ? 'ai-default' : 'tialo-neon')
  }

  return dashboard ? (
    <>
      <style>{`
        .tialo-theme-switcher{position:fixed;right:22px;top:78px;z-index:1000;display:flex;align-items:center;gap:9px;padding:7px 9px 7px 12px;border:1px solid rgba(69,230,161,.22);border-radius:999px;background:rgba(5,15,27,.88);backdrop-filter:blur(16px);box-shadow:0 12px 30px rgba(0,0,0,.22);color:#aab8c8;font-size:11px;font-weight:800}.tialo-theme-switcher button{border:1px solid rgba(69,230,161,.24);background:rgba(69,230,161,.08);color:#45e6a1;border-radius:999px;padding:7px 10px;font-size:10px;font-weight:900;cursor:pointer}.tialo-theme-switcher button:hover{background:rgba(69,230,161,.15)}
        .dashboard-shell .redesigned-stats{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:14px!important;width:100%!important}.dashboard-shell .redesigned-subjects{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:14px!important;width:100%!important}.dashboard-shell .redesigned-tools{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:14px!important;width:100%!important}.dashboard-shell .stat-card,.dashboard-shell .subject-card,.dashboard-shell .tool-card{min-width:0!important;width:100%!important}.dashboard-shell .stat-card{display:block!important}.dashboard-shell .subject-card{display:flex!important}.dashboard-shell .tool-card{display:grid!important}
        .dashboard-shell{background:radial-gradient(circle at 15% 5%,rgba(0,255,204,.10),transparent 25%),radial-gradient(circle at 88% 12%,rgba(90,80,255,.13),transparent 27%),#050b16!important}.dashboard-shell .sidebar{background:linear-gradient(180deg,#030913,#07101f)!important;border-right-color:rgba(0,255,204,.12)!important}.dashboard-shell .side-link.active{background:linear-gradient(90deg,rgba(0,255,204,.13),rgba(90,80,255,.06))!important;box-shadow:inset 2px 0 0 #00ffd0!important}.dashboard-shell .side-link.active span,.dashboard-shell .topbar-dot,.dashboard-shell .section-kicker,.dashboard-shell .subject-number,.dashboard-shell .tool-status b,.dashboard-shell .stat-card small b{color:#00ffd0!important}.dashboard-shell .welcome-card{background:radial-gradient(circle at 78% 50%,rgba(0,255,204,.12),transparent 25%),linear-gradient(135deg,rgba(0,255,204,.055),rgba(90,80,255,.045),rgba(255,255,255,.018))!important;border-color:rgba(0,255,204,.20)!important;box-shadow:0 0 80px rgba(0,255,204,.06),0 30px 80px rgba(0,0,0,.22)!important}.dashboard-shell .welcome-copy h1 span{color:#00ffd0!important}.dashboard-shell .orbit-ring{border-color:rgba(0,255,204,.25)!important}.dashboard-shell .orbit-core{border-color:rgba(0,255,204,.45)!important;box-shadow:0 0 55px rgba(0,255,204,.18)!important}.dashboard-shell .orbit-core span,.dashboard-shell .stat-icon,.dashboard-shell .tool-icon{color:#00ffd0!important}.dashboard-shell .stat-icon,.dashboard-shell .tool-icon{background:rgba(0,255,204,.08)!important;border-color:rgba(0,255,204,.15)!important}.dashboard-shell .primary{background:linear-gradient(135deg,#00ffd0,#00b8ff)!important;color:#02100e!important;box-shadow:0 10px 30px rgba(0,255,204,.18)!important}.dashboard-shell .stat-card:hover,.dashboard-shell .subject-card:hover,.dashboard-shell .tool-card:hover{border-color:rgba(0,255,204,.30)!important}.tialo-ai-default .dashboard-shell{background:radial-gradient(circle at 15% 5%,rgba(0,153,255,.14),transparent 25%),radial-gradient(circle at 88% 12%,rgba(126,76,255,.16),transparent 27%),#070914!important}.tialo-ai-default .dashboard-shell .side-link.active{background:linear-gradient(90deg,rgba(0,153,255,.15),rgba(126,76,255,.08))!important;box-shadow:inset 2px 0 0 #65a7ff!important}.tialo-ai-default .dashboard-shell .side-link.active span,.tialo-ai-default .dashboard-shell .topbar-dot,.tialo-ai-default .dashboard-shell .section-kicker,.tialo-ai-default .dashboard-shell .subject-number,.tialo-ai-default .dashboard-shell .tool-status b,.tialo-ai-default .dashboard-shell .stat-card small b{color:#65a7ff!important}.tialo-ai-default .dashboard-shell .welcome-card{background:radial-gradient(circle at 78% 50%,rgba(0,153,255,.14),transparent 25%),linear-gradient(135deg,rgba(0,153,255,.07),rgba(126,76,255,.07),rgba(255,255,255,.018))!important;border-color:rgba(101,167,255,.22)!important}.tialo-ai-default .dashboard-shell .welcome-copy h1 span{color:#65a7ff!important}.tialo-ai-default .dashboard-shell .orbit-ring{border-color:rgba(101,167,255,.28)!important}.tialo-ai-default .dashboard-shell .orbit-core{border-color:rgba(101,167,255,.45)!important;box-shadow:0 0 55px rgba(126,76,255,.20)!important}.tialo-ai-default .dashboard-shell .orbit-core span,.tialo-ai-default .dashboard-shell .stat-icon,.tialo-ai-default .dashboard-shell .tool-icon{color:#65a7ff!important}.tialo-ai-default .dashboard-shell .stat-icon,.tialo-ai-default .dashboard-shell .tool-icon{background:rgba(101,167,255,.08)!important;border-color:rgba(101,167,255,.16)!important}.tialo-ai-default .dashboard-shell .primary{background:linear-gradient(135deg,#65a7ff,#8d5cff)!important;color:#fff!important;box-shadow:0 10px 30px rgba(101,167,255,.18)!important}.tialo-ai-default .tialo-theme-switcher{border-color:rgba(101,167,255,.24)}.tialo-ai-default .tialo-theme-switcher button{border-color:rgba(101,167,255,.30);background:rgba(101,167,255,.10);color:#65a7ff}
        @media(max-width:1050px){.dashboard-shell .redesigned-stats{grid-template-columns:repeat(2,minmax(0,1fr))!important}.dashboard-shell .redesigned-subjects{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
        @media(max-width:800px){.tialo-theme-switcher{right:12px;top:72px}.dashboard-shell .redesigned-tools,.dashboard-shell .redesigned-subjects{grid-template-columns:1fr!important}.dashboard-shell .welcome-card{display:block!important}.dashboard-shell .welcome-orbit{display:none!important}}
        @media(max-width:600px){.dashboard-shell .redesigned-stats{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
        @media(max-width:500px){.tialo-theme-switcher span{display:none}.dashboard-shell .redesigned-stats{grid-template-columns:1fr 1fr!important}}
      `}</style>
      <div className="tialo-theme-switcher" aria-label="Colour theme"><span>{aiDefault ? 'AI Default' : 'TIALO Neon'}</span><button type="button" onClick={toggleTheme}>{aiDefault ? 'Use TIALO Neon' : 'AI Colours'}</button></div>
    </>
  ) : null
}
