import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL
 const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY
 if(!url||!key) return null
 return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}})
}
function siteUrl(){
 const raw=process.env.NEXT_PUBLIC_SITE_URL||process.env.NEXT_PUBLIC_VERCEL_URL||'https://tialo-final.vercel.app'
 return raw.startsWith('http')?raw.replace(/\/$/,''):`https://${raw.replace(/\/$/,'')}`
}

export async function GET(request){
 try{
  const {searchParams}=new URL(request.url)
  const requestId=searchParams.get('request')||''
  const email=(searchParams.get('email')||'').trim().toLowerCase()
  if(!/^[0-9a-f-]{36}$/i.test(requestId)||!email.includes('@')) return NextResponse.json({status:'error',message:'Invalid login request.'},{status:400})
  const admin=adminClient()
  if(!admin) return NextResponse.json({status:'error',message:'TIALO login handoff is not configured on the server.'},{status:503})
  const {data,error}=await admin.auth.admin.listUsers({page:1,perPage:1000})
  if(error) return NextResponse.json({status:'error',message:error.message},{status:500})
  const user=data?.users?.find(u=>(u.email||'').toLowerCase()===email)
  if(!user) return NextResponse.json({status:'waiting'})
  const meta=user.user_metadata||{}
  if(meta.tialo_login_request!==requestId||!meta.tialo_login_approved_at) return NextResponse.json({status:'waiting'})
  const approvedAt=Date.parse(meta.tialo_login_approved_at)
  if(!approvedAt||Date.now()-approvedAt>10*60*1000) return NextResponse.json({status:'error',message:'That approval expired. Please send a new sign-in link.'},{status:410})
  const redirectTo=siteUrl()+'/login/complete?handoff=1'
  const {data:link,error:linkError}=await admin.auth.admin.generateLink({type:'magiclink',email,options:{redirectTo}})
  if(linkError||!link?.properties?.action_link) return NextResponse.json({status:'error',message:linkError?.message||'Could not create the computer sign-in link.'},{status:500})
  await admin.auth.admin.updateUserById(user.id,{user_metadata:{...meta,tialo_login_request:null,tialo_login_approved_at:null,tialo_login_handoff_claimed_at:new Date().toISOString()}})
  return NextResponse.json({status:'approved',url:link.properties.action_link})
 }catch(error){return NextResponse.json({status:'error',message:error?.message||'Could not finish the computer sign-in.'},{status:500})}
}
