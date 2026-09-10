import './globals.css'

export const metadata = {
  title: 'TIALO — AI Academic Coach',
  description: 'A structured AI academic coach for students.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
