'use client'
import {useEffect,useState} from 'react'
import {getSupabaseBrowserClient} from '../../../lib/supabase'

async function routeAfterLogin(supabase,userId){
 const {data:profile}=await supabase.from('profiles').select('full_name,date_of_birth,role').eq('id',userId).maybeSingle()
 if(!profile?.full_name||!profile?.date_of_birth||!profile?.role){window.location.href='/onboarding';return}
 if(profile.role==='parent'){window.location.href='/parent';return}
 if(profile.role==='student'){
  const d=new Date(profile.date_of_birth+'T00:00:00'),n=new Date();let age=n.getFullYear()-d.getFullYear();if(n.getMonth()<d.getMonth()||(n.getMonth()===d.getMonth()&&n.getDate()<d.getDate()))age--
  if(age<16){const {data:l}=await supabase.from('parent_child').select('id').eq('child_id',userId).eq('status','active').limit(1).maybeSingle();if(!l){window.location.href='/parent-link';return}}
 }
 const {data:{session}}=await supabase.auth.getSession()
 const response=await fetch('/api/subscription/status',{headers:{Authorization:'Bearer '+(session?.access_token||'')}})
 const billing=await response.json().catch(()=>({}))
 window.location.href=response.ok&&billing.active?'/dashboard':'/billing'
}

export default function LoginComplete(){
 const [message,setMessage]=useState('Finishing your sign-in…')
 useEffect(()=>{
  let active=true
  const finish=async()=>{
   const supabase=getSupabaseBrowserClient()
   if(!supabase){setMessage('TIALO authentication is unavailable.');return}
   for(let i=0;i<20;i++){
    const {data:{session}}=await supabase.auth.getSession()
    if(session?.user){
     localStorage.setItem('tialo_trusted_device','1')
     localStorage.removeItem('tialo_login_request')
     await routeAfterLogin(supabase,session.user.id)
     return
    }
    await new Promise(r=>setTimeout(r,300))
   }
   if(active)setMessage('This sign-in link has expired or was already used. Please request a new one.')
  }
  finish()
  return()=>{active=false}
 },[])
 return <main className="shell auth-shell"><div className="auth-frame"><a className="brand auth-brand" href="/">TIA<span>LO</span></a><section className="auth-card panel approval-card"><div className="section-kicker">SIGNING YOU IN</div><h1>Opening your study space.</h1><p>{message}</p></section></div></main>
}
