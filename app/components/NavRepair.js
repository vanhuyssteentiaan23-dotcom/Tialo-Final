'use client'

import { useEffect, useState } from 'react'

const routes = { 'Daily Tasks': '/daily-tasks', Progress: '/progress' }

export default function NavRepair() {
  const [theme, setTheme] = useState('neon')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function repair() {
      document.querySelectorAll('a[href="#"]').forEach(link => {
        const label = link.textContent?.replace(/[^a-zA-Z ]/g, '').trim()
        if (routes[label]) link.setAttribute('href', routes[label])
      })
    }
    repair()
    const observer = new MutationObserver(repair)
    observer.observe(document.body, { childList: true, subtree: true })

    const saved = window.localStorage.getItem('tialo-theme') || 'neon'
    setTheme(saved)
    document.documentElement.dataset.tialoTheme = saved
    return () => observer.disconnect()
  }, [])

  function changeTheme(next) {
    setTheme(next)
    document.documentElement.dataset.tialoTheme = next
    window.localStorage.setItem('tialo-theme', next)
    setOpen(false)
  }

  return (
    <>
      <style jsx global>{`
        /* TIALO FUTURISTIC UI */
        .dashboard-shell{background:#020713!important;color:#f4f9ff!important;position:relative;overflow-x:hidden}
        .dashboard-shell:before{content:"";position:fixed;inset:0;pointer-events:none;z-index:0;background-image:linear-gradient(rgba(0,220,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(0,220,255,.025) 1px,transparent 1px);background-size:42px 42px;mask-image:linear-gradient(to bottom,#000,transparent 90%)}
        .dashboard-shell:after{content:"";position:fixed;width:720px;height:720px;right:-330px;bottom:-400px;border:1px solid rgba(0,238,255,.12);border-radius:50%;box-shadow:0 0 0 55px rgba(0,238,255,.025),0 0 0 110px rgba(111,74,255,.018);pointer-events:none;z-index:0}
        .dashboard-shell .sidebar,.dashboard-shell .dashboard-main{position:relative;z-index:1}
        .dashboard-shell .sidebar{background:linear-gradient(180deg,#020812,#06111f)!important;border-right:1px solid rgba(0,224,255,.14)!important;box-shadow:8px 0 45px rgba(0,0,0,.28)!important}
        .dashboard-shell .sidebar .brand{font-size:27px;letter-spacing:.12em;color:#f5fbff!important;text-shadow:0 0 24px rgba(0,235,255,.10)}
        .dashboard-shell .sidebar .brand span{color:#00f0ff!important;text-shadow:0 0 18px rgba(0,240,255,.7)}
        .dashboard-shell .sidebar-label{color:#45637b!important;letter-spacing:.22em}
        .dashboard-shell .side-link{height:46px!important;border-radius:11px!important;color:#7891a8!important}
        .dashboard-shell .side-link:hover{background:rgba(0,229,255,.055)!important;color:#e8fbff!important}
        .dashboard-shell .side-link.active{background:linear-gradient(90deg,rgba(0,240,255,.14),rgba(94,70,255,.04))!important;color:#fff!important;box-shadow:inset 2px 0 #00efff,0 0 25px rgba(0,240,255,.035)!important}
        .dashboard-shell .side-link.active span{color:#00efff!important;text-shadow:0 0 12px rgba(0,240,255,.7)}
        .dashboard-shell .avatar,.dashboard-shell .topbar-avatar{background:linear-gradient(145deg,#082b3b,#061524)!important;border:1px solid rgba(0,240,255,.45)!important;color:#00efff!important;box-shadow:0 0 22px rgba(0,240,255,.12)!important}
        .dashboard-shell .dashboard-topbar{background:rgba(2,9,18,.82)!important;border-bottom:1px solid rgba(0,224,255,.10)!important;backdrop-filter:blur(22px)!important}
        .dashboard-shell .topbar-dot{color:#00efff!important;text-shadow:0 0 10px #00efff}
        .dashboard-shell .dashboard-content{max-width:1320px!important;padding:38px 34px 90px!important}

        /* HERO */
        .dashboard-shell .welcome-card{min-height:310px!important;padding:48px 54px!important;border-radius:22px!important;border:1px solid rgba(0,239,255,.28)!important;background:linear-gradient(105deg,rgba(5,24,39,.98),rgba(5,14,29,.97) 55%,rgba(10,18,43,.98))!important;box-shadow:inset 0 1px rgba(255,255,255,.04),0 30px 80px rgba(0,0,0,.32),0 0 55px rgba(0,220,255,.035)!important;overflow:hidden!important}
        .dashboard-shell .welcome-card:before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent 0%,rgba(0,240,255,.045) 48%,rgba(106,72,255,.10) 100%)!important}
        .dashboard-shell .welcome-card:after{content:"";position:absolute;width:520px;height:520px;right:-130px;top:-155px;border:1px solid rgba(0,239,255,.24);border-radius:50%;box-shadow:0 0 0 32px rgba(0,239,255,.035),0 0 0 64px rgba(0,239,255,.02),0 0 0 96px rgba(120,75,255,.025);pointer-events:none}
        .dashboard-shell .welcome-copy{position:relative;z-index:3!important;max-width:720px!important}
        .dashboard-shell .welcome-copy .section-kicker{color:#54b3d6!important;letter-spacing:.23em}
        .dashboard-shell .welcome-copy h1{font-size:clamp(46px,5vw,72px)!important;line-height:.94!important;letter-spacing:-.065em!important;margin:16px 0 14px!important}
        .dashboard-shell .welcome-copy h1 span{color:#00efff!important;text-shadow:0 0 30px rgba(0,239,255,.22)!important}
        .dashboard-shell .welcome-copy p{font-size:15px!important;line-height:1.7!important;color:#91a9bd!important;max-width:650px!important}
        .dashboard-shell .welcome-actions{margin-top:25px!important;gap:11px!important}
        .dashboard-shell .primary{background:linear-gradient(100deg,#00dff0,#00f5aa)!important;color:#01110f!important;box-shadow:0 0 30px rgba(0,240,255,.16)!important;border:0!important}
        .dashboard-shell .secondary{background:rgba(255,255,255,.025)!important;border:1px solid rgba(82,174,230,.32)!important;color:#e4f2ff!important}
        .dashboard-shell .welcome-orbit{width:310px!important;height:230px!important;flex:0 0 310px!important;position:absolute!important;right:45px!important;top:39px!important}
        .dashboard-shell .ring-one{width:300px!important;height:165px!important;border-color:rgba(0,239,255,.27)!important}
        .dashboard-shell .ring-two{width:190px!important;height:265px!important;border-color:rgba(135,81,255,.28)!important}
        .dashboard-shell .orbit-core{width:94px!important;height:94px!important;background:radial-gradient(circle,#102f3e,#06111f 67%)!important;border-color:rgba(0,239,255,.55)!important;box-shadow:0 0 45px rgba(0,239,255,.18),inset 0 0 30px rgba(0,239,255,.08)!important}
        .dashboard-shell .orbit-core span{color:#00efff!important;text-shadow:0 0 16px rgba(0,239,255,.5)}

        /* FIXED GRID — never collapse into vertical strips */
        .dashboard-shell .stat-grid{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:14px!important;width:100%!important;margin:0!important}
        .dashboard-shell .stat-card{display:block!important;width:100%!important;min-width:0!important;min-height:145px!important;padding:19px!important;border-radius:16px!important;background:linear-gradient(145deg,rgba(8,25,43,.98),rgba(4,13,26,.99))!important;border:1px solid rgba(76,170,235,.15)!important;box-shadow:0 16px 38px rgba(0,0,0,.20)!important}
        .dashboard-shell .stat-card:hover{transform:translateY(-4px)!important;border-color:rgba(0,239,255,.36)!important;box-shadow:0 20px 45px rgba(0,0,0,.3),0 0 25px rgba(0,239,255,.04)!important}
        .dashboard-shell .stat-icon{width:42px!important;height:42px!important;border-radius:12px!important;background:rgba(0,239,255,.07)!important;border:1px solid rgba(0,239,255,.18)!important;color:#00efff!important}
        .dashboard-shell .stat-card span{color:#7f98ad!important}
        .dashboard-shell .stat-card strong{font-size:31px!important;color:#f6fbff!important}
        .dashboard-shell .stat-card small{color:#5e758b!important}
        .dashboard-shell .stat-card small b{color:#00efff!important}

        /* SUBJECTS */
        .dashboard-shell .subject-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:14px!important;width:100%!important}
        .dashboard-shell .subject-card{display:flex!important;flex-direction:column!important;width:100%!important;min-width:0!important;min-height:150px!important;padding:20px!important;border-radius:16px!important;background:linear-gradient(145deg,rgba(8,25,42,.98),rgba(4,13,26,.99))!important;border:1px solid rgba(76,170,235,.15)!important;box-shadow:0 15px 35px rgba(0,0,0,.18)!important}
        .dashboard-shell .subject-card:hover{transform:translateY(-4px)!important;border-color:rgba(0,239,255,.32)!important}
        .dashboard-shell .subject-number{color:#00efff!important}
        .dashboard-shell .subject-arrow{color:#7693aa!important;background:rgba(255,255,255,.035)!important}
        .dashboard-shell .subject-card h3{color:#f5f9ff!important}
        .dashboard-shell .subject-card p{color:#61788d!important}

        /* TOOLS */
        .dashboard-shell .tool-grid{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:13px!important;width:100%!important}
        .dashboard-shell .tool-card{display:grid!important;grid-template-columns:42px 1fr auto!important;align-items:center!important;width:100%!important;min-width:0!important;min-height:115px!important;padding:18px!important;border-radius:16px!important;background:linear-gradient(145deg,rgba(8,25,42,.98),rgba(4,13,26,.99))!important;border:1px solid rgba(76,170,235,.15)!important}
        .dashboard-shell .tool-icon{width:40px!important;height:40px!important;border-radius:11px!important;background:rgba(0,239,255,.07)!important;border:1px solid rgba(0,239,255,.15)!important;color:#00efff!important}
        .dashboard-shell .tool-card h3{color:#f2f8ff!important}
        .dashboard-shell .tool-card p{color:#61798e!important}
        .dashboard-shell .tool-status{color:#7c93a8!important}
        .dashboard-shell .tool-status b{color:#00efff!important}
        .dashboard-shell .privacy-strip{border-color:rgba(0,239,255,.13)!important;background:linear-gradient(90deg,rgba(0,239,255,.035),rgba(255,255,255,.012))!important}
        .dashboard-shell .privacy-title span{color:#00efff!important;background:rgba(0,239,255,.08)!important}
        .dashboard-shell .privacy-strip>span{color:#00efff!important}

        /* THEME SWITCHER */
        .tialo-theme-switcher{position:fixed;right:24px;top:77px;z-index:100;background:rgba(3,11,22,.94);border:1px solid rgba(0,239,255,.30);border-radius:12px;box-shadow:0 15px 45px rgba(0,0,0,.38),0 0 25px rgba(0,239,255,.05);backdrop-filter:blur(18px)}
        .tialo-theme-button{height:40px;border:0;background:transparent;color:#dffaff;padding:0 14px;cursor:pointer;font-weight:850;font-size:11px}.tialo-theme-button b{color:#00efff;margin-right:7px}.tialo-theme-menu{position:absolute;right:0;top:47px;width:245px;padding:8px;background:rgba(3,11,22,.98);border:1px solid rgba(0,239,255,.22);border-radius:14px;box-shadow:0 25px 70px rgba(0,0,0,.58)}.tialo-theme-title{font-size:9px;color:#668197;letter-spacing:.16em;text-transform:uppercase;padding:9px}.tialo-theme-option{width:100%;display:flex;align-items:center;gap:10px;border:0;background:transparent;color:#b7cad9;padding:11px 9px;border-radius:10px;text-align:left;cursor:pointer}.tialo-theme-option:hover,.tialo-theme-option.selected{background:rgba(255,255,255,.045);color:#fff}.tialo-theme-dot{width:27px;height:27px;border-radius:50%;flex:0 0 27px;border:1px solid rgba(255,255,255,.16)}.dot-neon{background:radial-gradient(circle at 35% 30%,#aaffff,#00eaff 43%,#154eff);box-shadow:0 0 18px rgba(0,239,255,.3)}.dot-ai{background:radial-gradient(circle at 35% 30%,#ded6ff,#765cff 48%,#245cff)}.dot-midnight{background:radial-gradient(circle at 35% 30%,#d9e4f0,#51647b 48%,#101824)}.dot-emerald{background:radial-gradient(circle at 35% 30%,#c0ffe9,#14dc9d 48%,#087c70)}.tialo-theme-option strong,.tialo-theme-option small{display:block}.tialo-theme-option strong{font-size:11px}.tialo-theme-option small{font-size:9px;color:#63798d;margin-top:2px}.tialo-theme-check{margin-left:auto;color:#00efff}

        /* AI DEFAULT */
        [data-tialo-theme="ai"] .dashboard-shell{--ai:#7b7cff}
        [data-tialo-theme="ai"] .dashboard-shell .welcome-card{border-color:rgba(111,119,255,.30)!important;background:linear-gradient(105deg,rgba(9,20,43,.98),rgba(8,13,32,.98) 55%,rgba(21,13,45,.98))!important}
        [data-tialo-theme="ai"] .dashboard-shell .welcome-copy h1 span,[data-tialo-theme="ai"] .dashboard-shell .stat-card small b,[data-tialo-theme="ai"] .dashboard-shell .subject-number,[data-tialo-theme="ai"] .dashboard-shell .privacy-strip>span{color:#7f8dff!important}
        [data-tialo-theme="ai"] .dashboard-shell .primary{background:linear-gradient(100deg,#5c7dff,#9b63ff)!important;color:#fff!important}
        [data-tialo-theme="ai"] .dashboard-shell .side-link.active{box-shadow:inset 2px 0 #7f8dff!important}
        [data-tialo-theme="ai"] .dashboard-shell .side-link.active span{color:#7f8dff!important}
        [data-tialo-theme="ai"] .dashboard-shell .avatar,[data-tialo-theme="ai"] .dashboard-shell .topbar-avatar{color:#7f8dff!important;border-color:rgba(127,141,255,.45)!important}
        [data-tialo-theme="ai"] .dashboard-shell .tialo-theme-switcher{border-color:rgba(127,141,255,.32)}

        @media(max-width:1100px){.dashboard-shell .stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.dashboard-shell .tool-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.dashboard-shell .welcome-orbit{opacity:.5;right:-40px}.dashboard-shell .welcome-copy{max-width:75%}}
        @media(max-width:800px){.dashboard-shell .dashboard-content{padding:28px 20px 70px!important}.dashboard-shell .welcome-card{padding:34px 28px!important}.dashboard-shell .welcome-orbit{display:none}.dashboard-shell .welcome-copy{max-width:100%}.dashboard-shell .subject-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.tialo-theme-switcher{right:12px;top:72px}}
        @media(max-width:560px){.dashboard-shell .stat-grid,.dashboard-shell .subject-grid,.dashboard-shell .tool-grid{grid-template-columns:1fr!important}.dashboard-shell .welcome-copy h1{font-size:39px!important}.dashboard-shell .dashboard-topbar{padding:0 16px!important}.tialo-theme-menu{right:-5px}}
      `}</style>

      <div className="tialo-theme-switcher">
        <button className="tialo-theme-button" type="button" onClick={() => setOpen(v => !v)}><b>✦</b>{theme === 'neon' ? 'TIALO Neon' : theme === 'ai' ? 'AI Default' : theme === 'midnight' ? 'Midnight' : 'Emerald'}　⌄</button>
        {open && <div className="tialo-theme-menu"><div className="tialo-theme-title">Choose colours</div>{[
          ['neon','TIALO Neon','Futuristic dark + cyan neon','dot-neon'],
          ['ai','AI Default','Blue + purple AI colours','dot-ai'],
          ['midnight','Midnight','Deep dark minimal','dot-midnight'],
          ['emerald','Emerald','Green futuristic','dot-emerald'],
        ].map(([id,name,desc,dot]) => <button key={id} className={`tialo-theme-option ${theme === id ? 'selected' : ''}`} onClick={() => changeTheme(id)}><span className={`tialo-theme-dot ${dot}`}></span><span><strong>{name}</strong><small>{desc}</small></span>{theme === id && <span className="tialo-theme-check">✓</span>}</button>)}</div>}
      </div>
    </>
  )
}
