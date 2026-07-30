'use client'

import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { IMG } from '@/lib/images'
import { isGraphiteCanvas } from '@/lib/theme-routes'

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
    <footer className="w-full pt-8 border-t bg-briefing-cream border-zen-black/5">
      <div className="flex flex-col md:flex-row justify-between items-center px-4 sm:px-8 md:px-12 pb-12 w-full max-w-screen-2xl mx-auto gap-6 md:gap-8">
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

      {/* Dark routes only: ease the page's LAST pixels into graphite #334155 —
          the one colour iOS paints the bottom rubber-band with (the root
          background; JS recolouring of the bounce is ignored, phone-verified).
          Ending the document on exactly that colour makes the bounce read as
          the page continuing, the same seam trick as the hero's bottom fade.
          Light routes bounce cream, so their footer must keep ending cream. */}
      {isGraphiteCanvas(pathname) && (
        <div
          aria-hidden
          className="h-28 w-full"
          // Smoothstep-shaped fade, sampled every 10% (11 stops): zero-speed
          // ends kill the hard start/stop edges a 2-stop linear blend shows,
          // and this stop density is fine enough to render as one continuous
          // curve (5 coarse stops read as layered bands; been there).
          style={{
            background:
              'linear-gradient(180deg, #F7F9FC 0%, #F2F4F7 10%, #E3E6EB 20%, #CDD1D8 30%, #B2B8C1 40%, #959DA9 50%, #788290 60%, #5D6979 70%, #475466 80%, #38475A 90%, #334155 100%)',
          }}
        />
      )}
    </footer>
  )
}
