# Landing Frontend Dump — foundation for external UI/motion tools (Kimi)

> **Generated snapshot (2026-07-06).** Exact contents of the current landing page + app shell +
> design tokens, concatenated for handing to an external UI tool. The source files in the repo
> remain the SSOT — regenerate this dump if they change.

## Read this first — stack & rules (or generated code will drift)

- **Stack:** Next 15.5 (App Router) · React 19 · **`motion` v12.38, imported as `motion/react`** (NOT `framer-motion`) · Tailwind **v4.2** · `lucide-react` icons.
- **Tailwind v4 is CSS-first — there is NO `tailwind.config.js`.** All tokens live in `app/globals.css` `@theme`; utilities like `font-headline`, `bg-basel-brick`, `text-zen-black` are generated from the `--font-*` / `--color-*` vars.
- **Fonts load via `@import` in `globals.css`, not `next/font`.** Use `font-headline` (Manrope) / `font-sans` (Inter + Noto Sans Thai).
- **Palette (single scheme, NO dark mode):** `zen-black` #122C4F · `briefing-cream` #F7F9FC · `basel-brick` #5B88B2 (single accent, no red) · `noir` #000000. Use tokens, never raw hex (except the hero gradient stops #0A1B33 / #122C4F).
- **Motion:** `motion/react` for entrance/scroll (`useScroll`/`useTransform`); CSS transitions for hover/scroll state. No animated `scale` on bitmaps; honor `prefers-reduced-motion`.
- **Conventions SSOT:** `docs/ui-alignment.md` (hand this over too) — hero z-layer anatomy, the #0A1B33 seam rule, parallax guardrails, review checklist.

---

## File index

- `app/page.tsx` — The landing page — hero layers, JAPAN wordmark, Start Journey, bottom-fade seam, socials, pathway cards. Parallax target.
- `app/components/Navbar.tsx` — Motion vocabulary SSOT — center-bloom oval, left→right pill unfurl, hover conventions, profile pill (NavUserMenu).
- `app/components/ClientLayout.tsx` — Page-transition motion — AnimatePresence fade+slide baseline.
- `app/components/Footer.tsx` — Footer (part of the shell under the landing).
- `app/layout.tsx` — Root shell — mounts Navbar → ClientLayout → Footer; metadata/icons; <html lang="th">.
- `app/globals.css` — Design foundation — @theme palette + font tokens, Google-Fonts @import, base styles, utilities.
- `lib/images.ts` — IMG registry — homeHero, logo, Cloudinary scenic URLs.

---

## `app/page.tsx`

The landing page — hero layers, JAPAN wordmark, Start Journey, bottom-fade seam, socials, pathway cards. Parallax target.

```tsx
'use client'

import Link from 'next/link'
import Image from 'next/image'
import { MessageSquare, BookOpen, Upload, ArrowRight, Compass } from 'lucide-react'
import { motion } from 'motion/react'
import { IMG } from '@/lib/images'

export default function Home() {
  const scrollToPathways = (e?: { preventDefault: () => void }) => {
    e?.preventDefault()
    document.getElementById('pathways')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <main className="bg-zen-black">
      {/* Full-bleed photo hero */}
      <section className="relative w-full h-screen min-h-[660px] overflow-hidden bg-zen-black">
        <Image
          src={IMG.homeHero}
          alt="Mt. Fuji rising behind a Lawson convenience store at dusk"
          fill
          priority
          className="object-cover object-[center_42%] z-0"
          sizes="100vw"
        />

        {/* Cool Midnight legibility overlay (top→bottom), on-palette with the blue scheme */}
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, rgba(18,44,79,0.55) 0%, rgba(18,44,79,0.2) 42%, rgba(18,44,79,0.5) 100%)',
          }}
        />

        {/* Bottom fade — dissolves the photo into the dark section below so there's
            no seam. Ends on EXACTLY #0A1B33, the top color of the next section. */}
        <div
          className="absolute inset-x-0 bottom-0 z-10 h-[18%] pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, rgba(10,27,51,0) 0%, rgba(10,27,51,0.25) 50%, rgba(10,27,51,0.8) 82%, #0A1B33 100%)',
          }}
        />

        {/* Center content: giant JAPAN wordmark + Start Journey */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="absolute inset-0 z-[15] flex flex-col items-center justify-center px-6 pointer-events-none"
        >
          <h1
            className="m-0 font-headline font-extrabold text-white text-center select-none text-[clamp(96px,25vw,350px)] leading-[0.9] tracking-[-0.03em]"
            style={{
              WebkitTextStroke: '1.4px rgba(255,255,255,0.5)',
              textShadow: '0 0 36px rgba(255,255,255,0.18), 0 6px 48px rgba(0,0,0,0.28)',
              opacity: 0.94,
              transform: 'translateY(-10%)',
            }}
          >
            JAPAN
          </h1>
          <button
            onClick={scrollToPathways}
            className="pointer-events-auto relative z-20 -translate-y-[22%] mt-[clamp(28px,4vh,52px)] inline-flex items-center justify-center rounded-full border-2 border-white/90 bg-white/25 text-white font-headline font-bold uppercase tracking-[0.18em] text-[clamp(15px,1.15vw,19px)] px-[clamp(40px,4vw,90px)] py-[clamp(16px,1.8vh,22px)] hover:bg-basel-brick/50 hover:border-basel-brick transition-colors duration-300 cursor-pointer"
          >
            Start Journey
          </button>
        </motion.div>

        {/* Learn More cue (bottom-left) */}
        <button
          onClick={scrollToPathways}
          aria-label="Learn more"
          className="group absolute left-[clamp(28px,4vw,72px)] bottom-[clamp(28px,4vh,56px)] z-20 flex flex-col items-center gap-3.5 cursor-pointer"
        >
          <span
            className="w-px h-[clamp(60px,12vh,120px)]"
            style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.7) 100%)' }}
          />
          <span
            className="font-headline font-semibold text-[11px] tracking-[0.32em] uppercase text-white/80 group-hover:text-basel-brick transition-colors"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            Learn More
          </span>
        </button>

        {/* Socials (bottom-right) — official Simple Icons: one consistent grid, uniform size, centered */}
        <div className="absolute right-[clamp(28px,4vw,72px)] bottom-[clamp(28px,4vh,56px)] z-20 flex items-center gap-4 text-white/85">
          <a
            href="https://www.instagram.com/dopamichi.jp/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="flex items-center justify-center w-6 h-6 shrink-0 hover:text-basel-brick hover:scale-110 transition-all duration-200"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="block" aria-hidden="true"><path d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077" /></svg>
          </a>
          <a
            href="https://www.facebook.com/profile.php?id=61591588770624"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook"
            className="flex items-center justify-center w-6 h-6 shrink-0 hover:text-basel-brick hover:scale-110 transition-all duration-200"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="block" aria-hidden="true"><path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" /></svg>
          </a>
          <a
            href="https://www.tiktok.com/@dopamichi"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="TikTok"
            className="flex items-center justify-center w-6 h-6 shrink-0 hover:text-basel-brick hover:scale-110 transition-all duration-200"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="block" aria-hidden="true"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" /></svg>
          </a>
        </div>
      </section>

      {/* Continuous Midnight gradient — one background for the whole lower page
          (pathways → content grid), not split per section. */}
      <div style={{ background: 'linear-gradient(180deg,#0A1B33 0%,#122C4F 100%)' }}>
        {/* Main Interaction Hub: Pathway Cards */}
        <section
          id="pathways"
          className="px-8 py-24 scroll-mt-24 text-briefing-cream"
        >
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-briefing-cream/15">
            {/* Option A: Chat — UNDER MAINTENANCE (redirects to /maintenance) */}
            <Link
              href="/maintenance"
              className="group relative p-12 border-b md:border-b-0 md:border-r border-briefing-cream/15 bg-white/[0.03] hover:bg-white/[0.06] transition-all duration-300 cursor-not-allowed"
            >
              <div className="absolute top-4 right-4 bg-basel-brick text-white text-[9px] font-black uppercase tracking-widest px-2 py-1">
                Maintenance
              </div>
              <MessageSquare className="w-10 h-10 mb-8 opacity-40" strokeWidth={1.5} />
              <h3 className="text-3xl font-headline font-bold mb-6 opacity-50">วางแผนการเดินทาง</h3>
              <p className="mb-10 text-lg opacity-40">AI Concierge กำลังงีบอยู่ที่เกียวโต 🍵 เดี๋ยวตื่นมาจะรีบกลับมาช่วยวางแผนให้นะคะ</p>
              <div className="flex items-center font-bold uppercase tracking-widest text-sm opacity-50">
                <span>Temporarily Offline</span>
                <ArrowRight className="ml-2 w-4 h-4" />
              </div>
            </Link>

            {/* Option B: Plan */}
            <Link
              href="/discover"
              className="group p-12 border-b md:border-b-0 md:border-r border-briefing-cream/15 hover:bg-basel-brick hover:text-briefing-cream transition-all duration-300 cursor-pointer"
            >
              <BookOpen className="w-10 h-10 mb-8" strokeWidth={1.5} />
              <h3 className="text-3xl font-headline font-bold mb-6">แพลนพร้อมเที่ยว</h3>
              <p className="mb-10 text-lg opacity-80">รวมแผนเที่ยวสุดฮิตที่คัดสรรมาแล้วจากกูรู เลือกวันเดินทางแล้วเจอเฉพาะแพลนที่เที่ยวได้จริง ไม่เจอสถานที่ปิด</p>
              <div className="flex items-center font-bold uppercase tracking-widest text-sm">
                <span>View Catalog</span>
                <ArrowRight className="ml-2 w-4 h-4" />
              </div>
            </Link>

            {/* Option C: AI Scanner (upload) */}
            <Link
              href="/ai-scanner"
              className="group p-12 hover:bg-basel-brick hover:text-briefing-cream transition-all duration-300 cursor-pointer"
            >
              <Upload className="w-10 h-10 mb-8" strokeWidth={1.5} />
              <h3 className="text-3xl font-headline font-bold mb-6">มีแผนอยู่แล้ว? อัปโหลดที่นี่</h3>
              <p className="mb-10 text-lg opacity-80">เพียงอัปโหลดไฟล์ PDF หรือรูปภาพแผนเดิมของคุณ ให้ AI ช่วยวิเคราะห์ ปรับปรุง และจองตั๋วให้ง่ายขึ้น</p>
              <div className="flex items-center font-bold uppercase tracking-widest text-sm">
                <span>Upload File</span>
                <ArrowRight className="ml-2 w-4 h-4" />
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Content Preview Grid */}
      <section className="px-4 sm:px-8 py-12 sm:py-24 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:h-[500px]">
          <div className="md:col-span-2 relative bg-zen-black group overflow-hidden h-64 md:h-full">
            <Image
              src={IMG.homeTokyo}
              alt="Tokyo"
              fill
              className="object-cover grayscale opacity-50 transition-all duration-700 group-hover:scale-105 group-hover:opacity-100 group-hover:grayscale-0"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            <div className="absolute inset-0 p-10 flex flex-col justify-end">
              <h4 className="text-briefing-cream text-4xl font-headline font-bold uppercase tracking-tight">Tokyo Nights</h4>
            </div>
          </div>

          <div className="md:col-span-2 grid grid-cols-2 gap-4">
            <div className="relative bg-zen-black group overflow-hidden h-48 md:h-full">
              <Image
                src={IMG.homeKyoto}
                alt="Kyoto"
                fill
                className="object-cover grayscale opacity-50 group-hover:opacity-100 group-hover:grayscale-0 transition-all"
                sizes="(max-width: 768px) 100vw, 25vw"
              />
              <div className="absolute inset-0 p-6 flex flex-col justify-end">
                <h4 className="text-briefing-cream font-headline font-bold uppercase text-sm">Zen Heritage</h4>
              </div>
            </div>

            <div className="relative bg-zen-black group overflow-hidden h-48 md:h-full">
              <Image
                src={IMG.homeFuji}
                alt="Fuji"
                fill
                className="object-cover grayscale opacity-50 group-hover:opacity-100 group-hover:grayscale-0 transition-all"
                sizes="(max-width: 768px) 100vw, 25vw"
              />
              <div className="absolute inset-0 p-6 flex flex-col justify-end">
                <h4 className="text-briefing-cream font-headline font-bold uppercase text-sm">The Peak</h4>
              </div>
            </div>

            <div className="col-span-2 bg-basel-brick flex flex-col items-center justify-center text-center p-8 text-briefing-cream">
              <Compass className="w-10 h-10 mb-2" strokeWidth={1.5} />
              <p className="font-headline font-bold text-2xl uppercase tracking-tighter">100K+ Explorers</p>
            </div>
          </div>
        </div>
      </section>
      </div>
    </main>
  )
}
```

## `app/components/Navbar.tsx`

Motion vocabulary SSOT — center-bloom oval, left→right pill unfurl, hover conventions, profile pill (NavUserMenu).

```tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { User, LogOut, Menu, X, Settings, ChevronDown, Shield, Heart } from 'lucide-react'
import { useSession, signIn, signOut } from 'next-auth/react'
import { IMG } from '@/lib/images'

const TABS = [
  // Home is intentionally omitted — the logo + "dopamichi" wordmark link home.
  { id: 'discover', label: 'Discover', href: '/discover' },
  { id: 'my-trip', label: 'My Trip', href: '/my-trip' },
  // Create = the hub that fans out to AI Chat + AI Scanner (see /create)
  { id: 'create', label: 'Create', href: '/create' },
]

/** The desktop nav links. `light` = white scheme (over the dark hero); otherwise
 *  the dark scheme (on the Cloud pill / Cloud bar). Rendered in two spots that
 *  share a Motion layoutId, so the group animates between them. */
function NavTabs({ isActive, light }: { isActive: (href: string) => boolean; light: boolean }) {
  return (
    <>
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          className={[
            'transition-colors duration-200',
            light
              ? isActive(tab.href)
                ? 'text-white'
                : 'text-white/70 hover:text-basel-brick'
              : isActive(tab.href)
                ? 'text-basel-brick'
                : 'text-zen-black opacity-70 hover:opacity-100 hover:text-basel-brick',
          ].join(' ')}
        >
          {tab.label}
        </Link>
      ))}
    </>
  )
}

export default function Navbar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  // Home page only: the bar is transparent over the dark photo hero (white
  // logo + links), fading to a dark blurred bar once scrolled past 40px. Other
  // pages have light backgrounds, so they keep the solid cream bar + dark text.
  const isHome = pathname === '/'
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Hide on liff routes only
  if (pathname.startsWith('/liff')) {
    return null
  }

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  // Home is always transparent — the nav rides in a floating Cloud pill instead
  // of a solid bar (no more dark sticky bar). Other pages keep the Cloud bar.
  const headerClass = isHome
    ? 'bg-transparent border-b border-transparent'
    : 'bg-briefing-cream/80 backdrop-blur-md border-b border-zen-black/5'

  return (
    <header className={`fixed top-0 w-full z-50 transition-colors duration-300 ${headerClass}`}>
      <nav className="relative flex justify-between items-center px-8 lg:px-12 py-6 w-full">
        {/* Left cluster — logo + wordmark, always visible. Kept OUT of the nav
            pill (which now lives in the center and grows from the middle). */}
        <div className="relative flex items-center shrink-0">
          <Link
            href="/"
            className="group relative flex items-center rounded-full h-[46px] pl-1 pr-4"
            onClick={() => setMobileOpen(false)}
          >
            {/* Dark pill — blooms from the center on scroll, same as the nav oval. */}
            {isHome && (
              <span
                aria-hidden
                className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full bg-black/20 group-hover:bg-black/30 transition-[width,height] duration-[700ms] ease-in-out"
                style={{
                  width: isScrolled ? '100%' : '0%',
                  height: isScrolled ? '46px' : '0px',
                }}
              />
            )}
            {/* Mascot in a Cloud circle (home) so the white logo reads on the hero. */}
            <span className={`relative inline-flex items-center justify-center w-[34px] h-[34px] rounded-full ${isHome ? 'bg-briefing-cream' : ''}`}>
              <Image
                src={IMG.logo}
                alt="dopamichi logo"
                width={32}
                height={32}
                className="h-6 w-6 object-contain"
                unoptimized
              />
            </span>
            <span className={`relative ml-3 text-2xl font-headline font-bold tracking-tighter ${isHome ? 'text-white' : 'text-zen-black'}`}>
              dopamichi
            </span>
          </Link>
        </div>

        {/* Centered nav — always centered in the bar. On the home hero it's white
            text on the transparent bar; on scroll a Cloud oval STRETCHES OUT OF
            THE MIDDLE to wrap the items (Home … Create). Other pages sit on the
            solid Cloud bar, so no oval is needed. */}
        <div className="pointer-events-none absolute inset-0 hidden md:flex items-center justify-center">
          <div className="relative flex items-center pointer-events-auto">
            {/* Cloud oval — width 0 → 100% AND height 0 → 52px, both centered, so
                it blooms from the middle point outward (left, right, top, bottom). */}
            {isHome && (
              <span
                aria-hidden
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-briefing-cream shadow-sm transition-[width,height] duration-[700ms] ease-in-out"
                style={{
                  width: isScrolled ? '100%' : '0%',
                  height: isScrolled ? '46px' : '0px',
                }}
              />
            )}
            <div className="relative flex items-center gap-8 px-8 font-headline tracking-tight font-bold text-lg whitespace-nowrap">
              <NavTabs isActive={isActive} light={isHome && !isScrolled} />
            </div>
          </div>
        </div>

        {/* Right side: user menu (desktop) + hamburger (mobile) */}
        <div className="flex items-center gap-3">
          <div className="hidden md:block">
            <NavUserMenu light={isHome} pill={isHome && isScrolled} />
          </div>
          {/* Mobile: current page label + profile + hamburger */}
          <div className="flex md:hidden items-center gap-2">
            <MobilePageLabel />
            <MobileAvatar />
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className={`transition-colors ${isHome ? 'text-white/80 hover:text-basel-brick' : 'text-zen-black/70 hover:text-basel-brick'}`}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileOpen ? <X size={24} strokeWidth={2} /> : <Menu size={24} strokeWidth={2} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden border-t border-zen-black/5 bg-briefing-cream/95 backdrop-blur-md">
          <div className="px-8 py-6 space-y-4">
            {/* Nav links */}
            {TABS.map((tab) => (
              <Link
                key={tab.id}
                href={tab.href}
                onClick={() => setMobileOpen(false)}
                className={`block py-2 font-headline font-bold text-lg transition-colors ${
                  isActive(tab.href)
                    ? 'text-basel-brick'
                    : 'text-zen-black/70 hover:text-basel-brick'
                }`}
              >
                {tab.label}
              </Link>
            ))}

            {/* Divider */}
            <div className="border-t border-zen-black/10 pt-4">
              <MobileUserMenu onClose={() => setMobileOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

// ── Desktop user menu ────────────────────────────────────────────────────────

function NavUserMenu({ light = false, pill = false }: { light?: boolean; pill?: boolean }) {
  const { data: session, status } = useSession()
  const [dropdownOpen, setDropdownOpen] = useState(false)

  if (status === 'loading') {
    return <div className="w-10 h-10" />
  }

  if (!session?.user) {
    return (
      <button
        onClick={() => signIn()}
        className={`group relative flex items-center gap-2.5 rounded-full h-[46px] pl-1 pr-4 transition-colors ${
          light ? (pill ? '' : 'hover:bg-white/10') : 'hover:bg-zen-black/5'
        }`}
      >
        {/* Home: dark pill blooms from the center on scroll, same as the nav oval. */}
        {light && (
          <span
            aria-hidden
            className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full bg-black/20 group-hover:bg-black/30 transition-[width,height] duration-[700ms] ease-in-out"
            style={{ width: pill ? '100%' : '0%', height: pill ? '46px' : '0px' }}
          />
        )}
        <div className={`relative w-[34px] h-[34px] rounded-full flex items-center justify-center border-2 ${light ? 'border-white/40 bg-white/10' : 'border-zen-black/10 bg-zen-black/5'}`}>
          <User size={16} className={light ? 'text-white/70' : 'text-zen-black/40'} strokeWidth={2} />
        </div>
        <span className={`relative text-xs font-bold ${light ? 'text-white' : 'text-zen-black'}`}>Sign in</span>
      </button>
    )
  }

  const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'SUPERADMIN'
  const displayName = session.user.name ?? session.user.email ?? 'User'

  const avatarRing = light ? 'border-white/40' : 'border-zen-black/10'

  return (
    <div className="relative">
      {/* Profile button — click to toggle dropdown */}
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className={`group relative flex items-center gap-2.5 rounded-full h-[46px] pl-1 pr-2.5 transition-colors ${
          light ? (pill ? '' : 'hover:bg-white/10') : 'hover:bg-zen-black/5'
        }`}
      >
        {/* Home: dark pill blooms from the center on scroll, same as the nav oval. */}
        {light && (
          <span
            aria-hidden
            className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full bg-black/20 group-hover:bg-black/30 transition-[width,height] duration-[700ms] ease-in-out"
            style={{ width: pill ? '100%' : '0%', height: pill ? '46px' : '0px' }}
          />
        )}
        {session.user.image ? (
          <Image
            src={session.user.image}
            alt={displayName}
            width={34}
            height={34}
            className={`relative w-[34px] h-[34px] rounded-full object-cover border-2 ${avatarRing}`}
            unoptimized={session.user.image.includes('res.cloudinary.com')}
          />
        ) : (
          <div className={`relative w-[34px] h-[34px] rounded-full flex items-center justify-center border-2 ${avatarRing} ${light ? 'bg-white/10' : 'bg-zen-black/5'}`}>
            <User size={16} className={light ? 'text-white/70' : 'text-zen-black/40'} strokeWidth={2} />
          </div>
        )}
        <div className="relative hidden lg:flex flex-col items-start leading-tight">
          <span className={`text-xs font-bold ${light ? 'text-white' : 'text-zen-black'}`}>{displayName}</span>
          <span className={`text-[8px] font-black uppercase tracking-[0.18em] ${light ? 'text-white/60' : 'text-zen-black/40'}`}>
            {session.user.role}
          </span>
        </div>
        <ChevronDown
          size={14}
          className={`relative transition-transform duration-200 ${light ? 'text-white/60' : 'text-zen-black/40'} ${
            dropdownOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown menu */}
      {dropdownOpen && (
        <>
          {/* Invisible backdrop to close dropdown on outside click */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setDropdownOpen(false)}
          />
          <div className="absolute right-0 top-full mt-3 z-50 w-64 bg-briefing-cream border border-zen-black/10 rounded-2xl shadow-2xl overflow-hidden">
            {/* User info header */}
            <div className="flex items-center gap-3 px-4 py-4 bg-zen-black/[0.03] border-b border-zen-black/5">
              {session.user.image ? (
                <Image
                  src={session.user.image}
                  alt={displayName}
                  width={40}
                  height={40}
                  className="w-10 h-10 rounded-full object-cover border-2 border-zen-black/10 flex-shrink-0"
                  unoptimized={session.user.image.includes('res.cloudinary.com')}
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-zen-black/5 flex items-center justify-center border-2 border-zen-black/10 flex-shrink-0">
                  <User size={18} className="text-zen-black/40" strokeWidth={2} />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-bold text-zen-black truncate">{displayName}</p>
                <p className="text-[10px] text-zen-black/50 truncate">{session.user.email}</p>
              </div>
            </div>

            {/* Menu items */}
            <div className="py-1.5">
              <Link
                href="/saved"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-zen-black/70 hover:bg-zen-black/[0.04] hover:text-zen-black transition-colors"
              >
                <Heart size={14} strokeWidth={2} />
                แพลนที่คุณชอบ · Your Saved
              </Link>

              <Link
                href="/settings"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-zen-black/70 hover:bg-zen-black/[0.04] hover:text-zen-black transition-colors"
              >
                <Settings size={14} strokeWidth={2} />
                Settings · ตั้งค่า
              </Link>

              {isAdmin && (
                <Link
                  href="/admin/dashboard"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-basel-brick hover:bg-basel-brick/10 transition-colors"
                >
                  <Shield size={14} strokeWidth={2} />
                  Admin Dashboard
                </Link>
              )}
            </div>

            {/* Sign out */}
            <div className="border-t border-zen-black/5 py-1.5">
              <button
                onClick={() => { signOut({ callbackUrl: '/' }); setDropdownOpen(false) }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-zen-black/50 hover:bg-zen-black/[0.04] hover:text-zen-black transition-colors"
              >
                <LogOut size={14} strokeWidth={2} />
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Mobile user menu ─────────────────────────────────────────────────────────

function MobileUserMenu({ onClose }: { onClose: () => void }) {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return <div className="py-2 text-zen-black/30 text-sm">Loading...</div>
  }

  if (!session?.user) {
    return (
      <button
        onClick={() => { signIn(); onClose() }}
        className="w-full py-3 bg-basel-brick text-white font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black transition-all"
      >
        Sign in
      </button>
    )
  }

  const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'SUPERADMIN'
  const displayName = session.user.name ?? session.user.email ?? 'User'

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {session.user.image ? (
          <Image
            src={session.user.image}
            alt={displayName}
            width={40}
            height={40}
            className="w-10 h-10 rounded-full object-cover border-2 border-zen-black/10"
            unoptimized={session.user.image.includes('res.cloudinary.com')}
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-zen-black/5 flex items-center justify-center border-2 border-zen-black/10">
            <User size={20} className="text-zen-black/40" strokeWidth={2} />
          </div>
        )}
        <div>
          <p className="text-sm font-bold text-zen-black">{displayName}</p>
          <p className="text-[9px] font-black uppercase tracking-widest text-zen-black/40">
            {session.user.role}
          </p>
        </div>
      </div>

      <Link
        href="/saved"
        onClick={onClose}
        className="flex items-center justify-center gap-2 w-full py-3 text-center border-2 border-basel-brick/40 text-basel-brick font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-basel-brick hover:text-white transition-all"
      >
        <Heart size={14} strokeWidth={2.5} />
        แพลนที่คุณชอบ · Saved
      </Link>

      <Link
        href="/settings"
        onClick={onClose}
        className="block w-full py-3 text-center border-2 border-zen-black text-zen-black font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black hover:text-white transition-all"
      >
        Settings · ตั้งค่า
      </Link>

      {isAdmin && (
        <Link
          href="/admin/dashboard"
          onClick={onClose}
          className="block w-full py-3 text-center border-2 border-basel-brick text-basel-brick font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-basel-brick hover:text-white transition-all"
        >
          Admin Dashboard
        </Link>
      )}

      <button
        onClick={() => { signOut({ callbackUrl: '/' }); onClose() }}
        className="w-full py-3 border-2 border-zen-black/40 text-zen-black/60 font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black hover:text-white transition-all"
      >
        Sign out
      </button>
    </div>
  )
}

// ── Mobile avatar (shown next to hamburger) ──────────────────────────────────

function MobileAvatar() {
  const { data: session } = useSession()

  if (!session?.user) return null

  return session.user.image ? (
    <Image
      src={session.user.image}
      alt={session.user.name ?? 'Profile'}
      width={32}
      height={32}
      className="w-8 h-8 rounded-full object-cover border border-zen-black/10"
      unoptimized={session.user.image.includes('res.cloudinary.com')}
    />
  ) : (
    <div className="w-8 h-8 rounded-full bg-zen-black/5 flex items-center justify-center border border-zen-black/10">
      <User size={14} className="text-zen-black/40" strokeWidth={2} />
    </div>
  )
}

// ── Mobile page label (shows which page the user is on) ─────────────────────

function MobilePageLabel() {
  const pathname = usePathname()
  const current = TABS.find((t) => {
    if (t.href === '/') return pathname === '/'
    return pathname.startsWith(t.href)
  })
  if (!current || current.href === '/') return null

  return (
    <span className="text-[9px] font-black uppercase tracking-widest text-basel-brick bg-basel-brick/10 px-2 py-1 rounded">
      {current.label}
    </span>
  )
}
```

## `app/components/ClientLayout.tsx`

Page-transition motion — AnimatePresence fade+slide baseline.

```tsx
'use client'

import { AnimatePresence, motion } from 'motion/react'
import { usePathname } from 'next/navigation'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
        className="flex-grow"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
```

## `app/components/Footer.tsx`

Footer (part of the shell under the landing).

```tsx
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

  return (
    <footer className="w-full py-12 bg-briefing-cream/50 border-t border-zen-black/5">
      <div className="flex flex-col md:flex-row justify-between items-center px-4 sm:px-8 md:px-12 w-full max-w-screen-2xl mx-auto gap-6 md:gap-8">
        <div className="flex flex-col items-center md:items-start gap-2">
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
```

## `app/layout.tsx`

Root shell — mounts Navbar → ClientLayout → Footer; metadata/icons; <html lang="th">.

```tsx
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
```

## `app/globals.css`

Design foundation — @theme palette + font tokens, Google-Fonts @import, base styles, utilities.

```css
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Inter:wght@400;500;600;700&family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap');
@import "tailwindcss";

@theme {
  --font-sans: "Inter", "Noto Sans Thai", ui-sans-serif, system-ui, sans-serif;
  --font-headline: "Manrope", "Noto Sans Thai", sans-serif;

  /* Dopamichi palette — clean 3-color cool scheme. Token names are kept as
     semantic slots so every bg-/text- class adopts the palette app-wide. */
  --color-zen-black: #122C4F;       /* Midnight — dark base + body text */
  --color-briefing-cream: #F7F9FC;  /* Cloud — light background + text-on-dark */
  --color-basel-brick: #5B88B2;     /* Ocean — the single accent (buttons/links/hover/active) */
  --color-noir: #000000;            /* Noir — true black, for deep contrast moments */
}

@layer base {
  body {
    @apply bg-briefing-cream text-zen-black font-sans antialiased;
  }
}

@layer utilities {
  .glass {
    @apply bg-white/70 backdrop-blur-xl;
  }
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
}
```

## `lib/images.ts`

IMG registry — homeHero, logo, Cloudinary scenic URLs.

```ts
/**
 * Central image registry.
 *
 * All scenic images now point to Cloudinary (permanent, optimized).
 * The old lh3.googleusercontent.com URLs were temporary Gemini Stitch
 * previews that could expire at any time.
 *
 * CLOUDINARY_URL env var is parsed automatically by next-cloudinary.
 * Cloud name: dubett62q
 */

export const CLOUDINARY_CLOUD = 'dubett62q'

/** Build a Cloudinary delivery URL with sane defaults. */
export function cld(
  publicId: string,
  opts: { w?: number; h?: number; crop?: string } = {},
) {
  const { w, h, crop = 'fill' } = opts
  const transforms = ['f_auto', 'q_auto']
  if (w) transforms.push(`w_${w}`)
  if (h) transforms.push(`h_${h}`)
  if (w || h) transforms.push(`c_${crop}`)
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/upload/${transforms.join(',')}/dopamichi/${publicId}`
}

// Cloudinary URLs — permanent, optimized scenic images
const CLD_HOKKAIDO = 'https://res.cloudinary.com/dubett62q/image/upload/q_auto/f_auto/v1775941309/hokkaido_woibhv.jpg'
const CLD_KYOTO = 'https://res.cloudinary.com/dubett62q/image/upload/q_auto/f_auto/v1775941309/20221009_185503_37323ab7_w1920_gkhahc.webp'
const CLD_TORII = 'https://res.cloudinary.com/dubett62q/image/upload/v1775942239/homeHERO_g6xadq.jpg'
const CLD_FUJI = 'https://res.cloudinary.com/dubett62q/image/upload/q_auto/f_auto/v1775941821/jpeg_large_202112291737-94b1bc95b0fa46be3b8d4899657dcd1b_g6kjrq.jpg'
const CLD_TOKYONIGHT = 'https://res.cloudinary.com/dubett62q/image/upload/q_auto/f_auto/v1775942067/nsplsh_36554c7933707875784c38_mv2_d_4997_3084_s_4_2_lj2aty.jpg'

/**
 * Named image slots. All scenic images use Cloudinary (permanent URLs).
 * Logo uses a local /public/ file (never expires, zero CDN dependency).
 */
export const IMG = {
  // ── Home page ──────────────────────────────────────────────────────────────
  // Full-bleed hero photo (Mt. Fuji behind a Lawson at dusk). Local /public/
  // file so it never expires and next/image can optimize it.
  homeHero: '/japan-hero.jpg',
  homeTokyo: CLD_TOKYONIGHT,
  homeKyoto: CLD_KYOTO,
  homeFuji: CLD_FUJI,

  // ── LIFF itinerary page ────────────────────────────────────────────────────
  liffHero: CLD_TORII,

  // ── Dopamichi logo ─────────────────────────────────────────────────────────
  // Served from /public/ — permanent, no CDN dependency, no expiring URLs.
  logo: '/android-chrome-192x192.png',

  // ── Stock photo pool ───────────────────────────────────────────────────────
  // Used as fallback covers for trips/templates without a custom coverImage.
  // Now that templates use direct Cloudinary URLs, these are mainly for
  // hash-based fallbacks in resolveCoverImage().
  stock1: CLD_HOKKAIDO,
  stock2: CLD_KYOTO,
  stock3: CLD_FUJI,
  stock4: CLD_TORII,
} as const
```
