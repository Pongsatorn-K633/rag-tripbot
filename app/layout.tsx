import type { Metadata, Viewport } from 'next'
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

/**
 * Tints the browser chrome (Android address bar; some desktop browsers) to
 * Graphite, matching the dark page canvas.
 *
 * ONE static value, never touched from JS: iOS ignores runtime updates to this
 * meta on client navigation (it paints its bars from the <html> background
 * instead — see ClientLayout's per-route root style), and the old
 * IntersectionObserver retint stranded a cream bar on dark pages. Graphite is
 * the right global pick now that home, /discover, /my-trips and /create are all
 * on the graphite canvas.
 */
export const viewport: Viewport = {
  themeColor: '#334155',
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
