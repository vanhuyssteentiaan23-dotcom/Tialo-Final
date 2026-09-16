'use client'
import { useEffect } from 'react'
const routes={'Daily Tasks':'/daily-tasks','Progress':'/progress'}
export default function NavRepair(){
 useEffect(()=>{function repair(){document.querySelectorAll('a[href="#"]').forEach(link=>{const label=link.textContent?.replace(/[^a-zA-Z ]/g,'').trim();if(routes[label])link.setAttribute('href',routes[label])})}repair();const observer=new MutationObserver(repair);observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect()},[])
 return null
}
