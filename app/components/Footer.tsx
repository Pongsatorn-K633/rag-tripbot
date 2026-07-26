'use client'

import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { IMG } from '@/lib/images'

export default function Footer() {
  const pathname = usePathname()

  // Hide on chat and liff routes
  if (pathname === '/chat' || pathname.startsWith('/liff')) {
    return null
  }

  // Cream on EVERY route — the dark pages end on a light footer, the way home's
  // gradient already resolves to Cloud. OPAQUE, not the old /50: a translucent
  // footer inherits whatever is behind it, and ClientLayout's canvas is dark on
  // the graphite routes, which turned it muddy with unreadable text.
  return (
    <footer className="w-full pt-8 pb-12 border-t bg-briefing-cream border-zen-black/5">
      <div className="flex flex-col md:flex-row justify-between items-center px-4 sm:px-8 md:px-12 w-full max-w-screen-2xl mx-auto gap-6 md:gap-8">
        {/* gap-6 on mobile MATCHES the outer stack's gap-6, so the three
            stacked lines (logo · copyright · links) sit on one even rhythm.
            Desktop tightens back to gap-3 — there the links are beside this
            block, not below it. */}
        <div className="flex flex-col items-center md:items-start gap-6 md:gap-3">
          <div className="flex items-center gap-2">
            <Image
              src={IMG.logo}
              alt="logo"
              width={20}
              height={20}
              className="h-5 w-5 grayscale opacity-50"
            />
            <span className="font-headline font-bold text-sm text-zen-black">dopamichi</span>
          </div>
          <p className="font-sans text-xs tracking-widest uppercase text-zen-black/60">
            &copy; 2026 dopamichi. All rights reserved.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-4 sm:gap-6 md:gap-10">
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
