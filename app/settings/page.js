'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '../../lib/supabase'

const themes=[
 {id:'tialo-neon',name:'TIALO Neon',description:'Cyan, electric blue and violet',gradient:'linear-gradient(135deg,#00f5ff,#7c3cff)'},
 {id:'ai-default',name:'AI Default',description:'Clean blue and purple',gradient:'linear-gradient(135deg,#65a7ff,#9b6cff)'},
 {id:'midnight',name:'Midnight',description:'Deep dark minimal',gradient:'linear-gradient(135deg,#dbe7f7,#667892)'},
 {id:'emerald',name:'Emerald',description:'Bright green futuristic',gradient:'linear-gradient(135deg,#00ff9d,#00c98b)'},
 {id:'sunset',name:'Sunset',description:'Orange and pink neon',gradient:'linear-gradient(135deg,#ffb347,#ff4f9a)'},
]

export default function Settings(){
 const [theme,setTheme]=useState('tialo-neon')
 const [email,setEmail]=useState('')
 const [name,setName]=useState('')
 useEffect(()=>{
  const saved=localStorage.getItem('tialo-color-theme')||'tialo-neon'
  setTheme(saved)
  applyTheme(saved)
  const load=async()=>{
   const supabase=getSupabaseBrowserClient()
   const {data:{user}}=await supabase.auth.getUser()
   if(!user){location.href='/login';return}
   setEmail(user.email||'')
   const {data}=await supabase.from('profiles').select('full_name').eq('id',user.id).maybeSingle()
   setName(data?.full_name||'')
  }
  load()
 },[])
 function applyTheme(id){
  document.documentElement.classList.remove('tialo-ai-default','tialo-midnight','tialo-emerald','tialo-sunset')
  if(id!=='tialo-neon')document.documentElement.classList.add('tialo-'+id.replace('tialo-',''))
 }
 function chooseTheme(id){setTheme(id);localStorage.setItem('tialo-color-theme',id);applyTheme(id)}
 async function signOut(){const supabase=getSupabaseBrowserClient();await supabase?.auth.signOut();location.href='/'}
 return <main className="settings-page">
  <style>{`
   .settings-page{min-height:100vh;background:#020711;color:#eef8ff;padding:34px;font-family:Arial,sans-serif}
   .settings-wrap{max-width:980px;margin:0 auto}.settings-back{display:inline-flex;color:#7f9ab4;text-decoration:none;font-size:12px;margin-bottom:28px}.settings-header{display:flex;justify-content:space-between;align-items:end;gap:20px;margin-bottom:28px}.settings-kicker{font-size:9px;letter-spacing:.2em;color:#00f5ff;font-weight:900}.settings-header h1{font-size:38px;letter-spacing:-.04em;margin:8px 0}.settings-header p{color:#7189a3;font-size:13px}.settings-card{background:linear-gradient(145deg,rgba(8,23,40,.95),rgba(4,11,24,.94));border:1px solid rgba(0,245,255,.13);border-radius:18px;padding:24px;margin-bottom:16px;box-shadow:0 18px 45px rgba(0,0,0,.22)}.settings-card h2{font-size:15px;margin:0 0 5px}.settings-card>p{font-size:11px;color:#7189a3;margin:0 0 20px}.theme-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.theme-item{display:flex;align-items:center;gap:13px;padding:14px;border:1px solid rgba(255,255,255,.07);border-radius:13px;background:rgba(255,255,255,.02);color:#dcecff;text-align:left;cursor:pointer}.theme-item:hover,.theme-item.selected{border-color:rgba(0,245,255,.35);background:rgba(0,245,255,.045)}.swatch{width:34px;height:34px;border-radius:50%;flex:none}.theme-item strong,.theme-item small{display:block}.theme-item strong{font-size:11px}.theme-item small{font-size:9px;color:#7189a3;margin-top:4px}.check{margin-left:auto;color:#00f5ff}.account-row{display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-bottom:1px solid rgba(255,255,255,.055)}.account-row:last-child{border-bottom:0}.account-row span{font-size:10px;color:#7189a3}.account-row strong{font-size:12px}.danger{border-color:rgba(255,80,100,.16)}.signout{border:1px solid rgba(255,80,100,.24);background:rgba(255,80,100,.05);color:#ff9aa7;padding:10px 14px;border-radius:10px;cursor:pointer;font-weight:700}.settings-footer{margin-top:24px;color:#526a83;font-size:10px}@media(max-width:600px){.settings-page{padding:20px 14px}.settings-header{display:block}.settings-header h1{font-size:32px}.theme-grid{grid-template-columns:1fr}}
  `}</style>
  <div className="settings-wrap">
   <a className="settings-back" href="/dashboard">← Back to dashboard</a>
   <div className="settings-header"><div><div className="settings-kicker">TIALO CONFIGURATION</div><h1>Settings</h1><p>Control your account and TIALO's appearance.</p></div></div>
   <section className="settings-card"><h2>Appearance</h2><p>Choose the visual theme used across your TIALO workspace.</p><div className="theme-grid">{themes.map(t=><button className={`theme-item ${theme===t.id?'selected':''}`} key={t.id} onClick={()=>chooseTheme(t.id)}><span className="swatch" style={{background:t.gradient}}/><span><strong>{t.name}</strong><small>{t.description}</small></span><b className="check">{theme===t.id?'✓':''}</b></button>)}</div></section>
   <section className="settings-card"><h2>Account</h2><p>Your current TIALO account information.</p><div className="account-row"><span>Name</span><strong>{name||'—'}</strong></div><div className="account-row"><span>Email</span><strong>{email||'—'}</strong></div></section>
   <section className="settings-card danger"><h2>Session</h2><p>Sign out of your TIALO account on this device.</p><button className="signout" onClick={signOut}>Sign out</button></section>
   <div className="settings-footer">TIALO · Academic workspace</div>
  </div>
 </main>
}
