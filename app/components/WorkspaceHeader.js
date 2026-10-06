'use client'
import {useState} from 'react'

const nav=[
  ['Overview','⌂','/dashboard'],
  ['Study Planner','◈','/dashboard?tool=planner'],
  ['Subjects','▱','/subjects'],
  ['Summaries','▤','/summaries'],
  ['AI Tutor','✦','/ai-tutor'],
  ['Mock Exams','□','/mock-exams'],
  ['AI Tutor Voice','◉','/dashboard?tool=voice'],
  ['Visual Learning','△','/dashboard?tool=visual'],
  ['Flashcards','▣','/dashboard?tool=flashcards'],
  ['AI Assignment Checker','✓','/dashboard?tool=assignment'],
  ['Daily Tasks','✓','/daily-tasks'],
  ['Progress','↗','/progress'],
  ['Level XP','★','/dashboard?tool=xp'],
  ['Settings','⚙','/settings'],
]

export default function WorkspaceHeader({title,subtitle='',active=''}) {
  const [open,setOpen]=useState(false)
  return <>
    <header className="dashboard-topbar workspace-mobile-header">
      <button className="workspace-menu" onClick={()=>setOpen(true)} aria-label="Open workspace menu">☰</button>
      <div className="workspace-title"><span className="topbar-title">{title}</span><span className="topbar-dot">●</span><span className="muted">{subtitle}</span></div>
      <a className="workspace-avatar" href="/dashboard" aria-label="Dashboard">T</a>
    </header>
    {open&&<>
      <div className="workspace-drawer-backdrop" onClick={()=>setOpen(false)}/>
      <aside className="workspace-drawer">
        <div className="workspace-drawer-head"><a className="brand" href="/dashboard">TIA<span>LO</span></a><button onClick={()=>setOpen(false)} aria-label="Close workspace menu">×</button></div>
        <div className="sidebar-label">Workspace</div>
        <nav className="sidebar-nav">{nav.map(([label,icon,href])=><a className={'side-link '+(href===active?'active':'')} href={href} key={href}><span>{icon}</span>{label}</a>)}</nav>
      </aside>
    </>}
  </>
}