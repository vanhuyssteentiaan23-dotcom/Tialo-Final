import './globals.css'
import './dashboard/premium-dashboard.css'
import './theme-system.css'
import './reference-mirror.css'
import './tialo-production-ui.css'
import NavRepair from './components/NavRepair'
import ThemeSync from './components/ThemeSync'

export const metadata = {
  title: 'TIALO — AI Academic Coach',
  description: 'A structured AI academic coach for students.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body><ThemeSync /><NavRepair />{children}</body>
    </html>
  )
}
