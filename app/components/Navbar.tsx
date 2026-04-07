'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User } from 'lucide-react'
import { IMG } from '@/lib/images'

const TABS = [
  { id: 'home', label: 'Home', href: '/' },
  { id: 'chat', label: 'AI Chat', href: '/chat' },
  { id: 'gallery', label: 'Gallery', href: '/gallery' },
  { id: 'templates', label: 'Templates', href: '/templates' },
]

export default function Navbar() {
  const pathname = usePathname()

  // Hide on chat and liff routes
  if (pathname === '/chat' || pathname.startsWith('/liff')) {
    return null
  }

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-zen-black/5">
      <nav className="flex justify-between items-center px-8 py-6 w-full max-w-screen-2xl mx-auto">
        <Link
          href="/"
          className="flex items-center gap-3"
        >
          <img
            alt="dopamichi logo"
            className="h-8 w-8 object-contain"
            src={IMG.logo}
          />
          <span className="text-2xl font-headline font-bold tracking-tighter text-zen-black">
            dopamichi
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8 font-headline tracking-tight font-bold text-lg">
          {TABS.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              className={[
                'transition-all duration-200 pb-1 border-b-2',
                isActive(tab.href)
                  ? 'text-basel-brick border-basel-brick'
                  : 'text-zen-black opacity-70 hover:opacity-100 hover:text-basel-brick border-transparent',
              ].join(' ')}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <button className="active:scale-95 duration-150 transition-transform text-basel-brick">
            <User size={28} strokeWidth={1.5} />
          </button>
        </div>
      </nav>
    </header>
  )
}
