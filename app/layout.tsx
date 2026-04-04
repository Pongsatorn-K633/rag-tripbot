import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'RAG TripBot',
  description: 'Japan trip planning chatbot for Thai travelers',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  )
}
