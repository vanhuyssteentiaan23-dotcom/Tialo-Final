'use client'
import {useState} from 'react'

const nav=[
  ['Overview','/dashboard'],
  ['Subjects','/subjects'],
  ['AI Tutor','/ai-tutor'],
  ['Mock Exams','/mock-exams'],
  ['Daily Tasks','/daily-tasks'],
  ['Progress','/progress'],
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
        <nav className="sidebar-nav">{nav.map(([label,href])=><a className={'side-link '+(href===active?'active':'')} href={href} key={href}><span>{label==='Overview'?'⌂':label==='Subjects'?'▱':label==='AI Tutor'?'✦':label==='Mock Exams'?'□':label==='Daily Tasks'?'✓':'↗'}</span>{label}</a>)}</nav>
      </aside>
    </>}
  </>
}