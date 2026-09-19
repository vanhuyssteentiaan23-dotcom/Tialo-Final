export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL
 const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY
 if(!url||!key) return null
 return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}})
}

export async function POST(request){
 try{
  const body=await request.json().catch(()=>({}))
  const requestId=String(body.requestId||'')
  if(!/^[0-9a-f-]{36}$/i.test(requestId)) return NextResponse.json({error:'Invalid approval request.'},{status:400})
  const token=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim()
  if(!token) return NextResponse.json({error:'Authentication required.'},{status:401})
  const admin=adminClient()
  if(!admin) return NextResponse.json({error:'TIALO login handoff is not configured on the server.'},{status:503})
  const {data:{user},error:userError}=await admin.auth.getUser(token)
  if(userError||!user) return NextResponse.json({error:'Approval session is invalid or expired.'},{status:401})
  const metadata={...(user.user_metadata||{}),tialo_login_request:requestId,tialo_login_approved_at:new Date().toISOString()}
  const {error}=await admin.auth.admin.updateUserById(user.id,{user_metadata:metadata})
  if(error) return NextResponse.json({error:error.message},{status:500})
  return NextResponse.json({ok:true})
 }catch(error){return NextResponse.json({error:error?.message||'Could not approve this computer.'},{status:500})}
}
