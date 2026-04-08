import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/app/components/Navbar'
import Footer from '@/app/components/Footer'
import ClientLayout from '@/app/components/ClientLayout'
import Providers from '@/app/providers'

export const metadata: Metadata = {
  title: 'Dopamichi',
  description: 'ผู้ช่วยวางแผนเที่ยวญี่ปุ่นสำหรับนักเดินทางชาวไทย',
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: { url: '/apple-touch-icon.png', sizes: '180x180' },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="th">
      <body className="flex flex-col min-h-screen">
        <Providers>
          <Navbar />
          <ClientLayout>
            {children}
          </ClientLayout>
          <Footer />
        </Providers>
      </body>
    </html>
  )
}
