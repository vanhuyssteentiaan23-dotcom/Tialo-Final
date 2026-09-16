import './globals.css'
import './dashboard/premium-dashboard.css'
import NavRepair from './components/NavRepair'

export const metadata = {
  title: 'TIALO — AI Academic Coach',
  description: 'A structured AI academic coach for students.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body><NavRepair />{children}</body>
    </html>
  )
}
