import './globals.css'
import LanguageSync from './components/LanguageSync'

export const metadata = { title:'TIALO — AI Academic Workspace', description:'A calm, structured AI academic workspace for students.' }

export default function RootLayout({children}){return <html lang="en"><body>{children}<LanguageSync /></body></html>}