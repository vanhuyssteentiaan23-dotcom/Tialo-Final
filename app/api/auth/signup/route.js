export const runtime='nodejs'
import {NextResponse} from 'next/server'
import {createClient} from '@supabase/supabase-js'

function admin(){
 const raw=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL
 let url=raw
 try{url=new URL(raw).origin}catch{}
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY
 if(!url||!key)return null
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
}

export async function POST(request){
 try{
  const body=await request.json()
  const email=String(body?.email||'').trim().toLowerCase()
  const password=String(body?.password||'')
  if(!email||!email.includes('@'))return NextResponse.json({error:'Enter a valid email address.'},{status:400})
  if(password.length<8)return NextResponse.json({error:'Your password must be at least 8 characters.'},{status:400})
  const a=admin()
  if(!a)return NextResponse.json({error:'Server authentication is not configured.'},{status:503})
  const {data:list,error:listError}=await a.auth.admin.listUsers({page:1,perPage:1000})
  if(listError)return NextResponse.json({error:listError.message},{status:500})
  const existing=list?.users?.find(u=>(u.email||'').toLowerCase()===email)
  if(existing){
   return NextResponse.json({error:'An account with this email already exists. Use Sign in instead.'},{status:409})
  }
  const {data,error}=await a.auth.admin.createUser({email,password,email_confirm:true})
  if(error)return NextResponse.json({error:error.message},{status:400})
  return NextResponse.json({userId:data.user?.id||null},{status:201})
 }catch(e){
  return NextResponse.json({error:e?.message||'Could not create your account.'},{status:500})
 }
}
