'use client'

import { usePathname } from 'next/navigation'
import { IMG } from '@/lib/images'

export default function Footer() {
  const pathname = usePathname()

  // Hide on chat and liff routes
  if (pathname === '/chat' || pathname.startsWith('/liff')) {
    return null
  }

  return (
    <footer className="w-full py-12 bg-white/50 border-t border-black/5">
      <div className="flex flex-col md:flex-row justify-between items-center px-12 w-full max-w-screen-2xl mx-auto gap-8">
        <div className="flex flex-col items-center md:items-start gap-2">
          <div className="flex items-center gap-2">
            <img
              alt="logo"
              className="h-5 w-5 grayscale opacity-50"
              src={IMG.logo}
            />
            <span className="font-headline font-bold text-sm text-zen-black">dopamichi</span>
          </div>
          <p className="font-sans text-xs tracking-widest uppercase text-zen-black/60">
            &copy; 2026 dopamichi. All rights reserved.
          </p>
        </div>

        <div className="flex gap-10">
          {[
            { label: 'Privacy', href: '/privacy' },
            { label: 'Terms', href: '/terms' },
            { label: 'Support', href: '/support' },
            { label: 'About', href: '/about' },
          ].map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="font-sans text-xs tracking-widest uppercase text-zen-black/60 hover:underline hover:text-basel-brick transition-all"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  )
}
