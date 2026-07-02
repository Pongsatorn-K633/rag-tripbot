'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { User, LogOut, Menu, X, Settings, ChevronDown, Shield, Heart } from 'lucide-react'
import { useSession, signIn, signOut } from 'next-auth/react'
import { IMG } from '@/lib/images'

const TABS = [
  // Home link removed — the logo <Link href="/"> already goes home.
  { id: 'my-trip', label: 'My Trip', href: '/my-trip' },
  { id: 'pre-planned', label: 'Pre-planned', href: '/pre-planned' },
  { id: 'doc-to-trip', label: 'Doc-to-Trip', href: '/doc-to-trip' },
  // AI Chat is under maintenance — disabled in nav, /chat redirects to /maintenance
  { id: 'chat', label: 'AI Chat', href: '/chat', disabled: true },
]

/** The desktop nav links. `light` = white scheme (over the dark hero); otherwise
 *  the dark scheme (on the Cloud pill / Cloud bar). Rendered in two spots that
 *  share a Motion layoutId, so the group animates between them. */
function NavTabs({ isActive, light }: { isActive: (href: string) => boolean; light: boolean }) {
  return (
    <>
      {TABS.map((tab) =>
        tab.disabled ? (
          <span
            key={tab.id}
            title="Under maintenance · ปรับปรุงอยู่"
            className={`relative cursor-not-allowed select-none ${light ? 'text-white/40' : 'text-zen-black/30'}`}
          >
            {tab.label}
            <span className="ml-2 align-middle text-[8px] font-black uppercase tracking-widest bg-basel-brick text-white px-1.5 py-0.5 rounded-sm">
              Soon
            </span>
          </span>
        ) : (
          <Link
            key={tab.id}
            href={tab.href}
            className={[
              'relative transition-colors duration-200',
              "after:content-[''] after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:rounded-full after:transition-colors",
              light
                ? isActive(tab.href)
                  ? 'text-white after:bg-white'
                  : 'text-white/70 hover:text-basel-brick after:bg-transparent'
                : isActive(tab.href)
                  ? 'text-basel-brick after:bg-basel-brick'
                  : 'text-zen-black opacity-70 hover:opacity-100 hover:text-basel-brick after:bg-transparent',
            ].join(' ')}
          >
            {tab.label}
          </Link>
        )
      )}
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
        {/* Left cluster = the Cloud pill. The nav UNFOLDS out of the logo via a
            `grid-template-columns: 0fr → 1fr` transition — a real layout reflow,
            so the pill stretches slowly AND stays pixel-crisp (no scale). */}
        <div
          className={`flex items-center rounded-full transition-[background-color,padding] duration-300 ${
            isHome
              ? isScrolled
                ? 'bg-briefing-cream pl-3 pr-3 md:pr-6 py-1.5'
                : 'bg-briefing-cream hover:bg-briefing-cream/90 px-3 py-1.5'
              : ''
          }`}
        >
          <Link
            href="/"
            className="flex items-center gap-3 shrink-0"
            onClick={() => setMobileOpen(false)}
          >
            <Image
              src={IMG.logo}
              alt="dopamichi logo"
              width={32}
              height={32}
              className="h-8 w-8 object-contain translate-y-[1.5px]"
              unoptimized
            />
            <span className="text-2xl font-headline font-bold tracking-tighter text-zen-black">
              dopamichi
            </span>
          </Link>

          {/* Nav slot: collapsed (0fr) at the top, expands (1fr) on scroll. */}
          <div
            className="hidden md:grid transition-[grid-template-columns] duration-[1200ms] ease-in-out"
            style={{ gridTemplateColumns: isHome && isScrolled ? '1fr' : '0fr' }}
          >
            <div className="overflow-hidden">
              <div className="flex items-center gap-8 pl-8 font-headline tracking-tight font-bold text-lg whitespace-nowrap">
                <NavTabs isActive={isActive} light={false} />
              </div>
            </div>
          </div>
        </div>

        {/* Centered nav — over the hero at the top, and on non-home pages. Fades
            out as the pill unfolds, so it reads as moving from center → left. */}
        <div className="pointer-events-none absolute inset-0 hidden md:grid grid-cols-[1fr_auto_1fr] items-center px-8">
          <div />
          <div
            className={`flex items-center gap-8 font-headline tracking-tight font-bold text-lg transition-opacity duration-[500ms] ease-in-out ${
              isHome && isScrolled ? 'opacity-0' : 'opacity-100 pointer-events-auto'
            }`}
          >
            <NavTabs isActive={isActive} light={isHome && !isScrolled} />
          </div>
          <div />
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
            {TABS.map((tab) =>
              tab.disabled ? (
                <div
                  key={tab.id}
                  className="flex items-center justify-between py-2 text-zen-black/30"
                >
                  <span className="font-headline font-bold text-lg">{tab.label}</span>
                  <span className="text-[8px] font-black uppercase tracking-widest bg-basel-brick text-white px-1.5 py-0.5 rounded-sm">
                    Soon
                  </span>
                </div>
              ) : (
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
              )
            )}

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
        className={`group flex items-center gap-2.5 rounded-full py-1 pl-1 pr-4 transition-colors ${
          pill ? 'bg-black/20 hover:bg-black/30' : light ? 'hover:bg-white/10' : 'hover:bg-zen-black/5'
        }`}
      >
        <div className={`w-[34px] h-[34px] rounded-full flex items-center justify-center border-2 ${light ? 'border-white/40 bg-white/10' : 'border-zen-black/10 bg-zen-black/5'}`}>
          <User size={16} className={light ? 'text-white/70' : 'text-zen-black/40'} strokeWidth={2} />
        </div>
        <span className={`text-xs font-bold ${light ? 'text-white' : 'text-zen-black'}`}>Sign in</span>
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
        className={`group flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2.5 transition-colors ${
          pill ? 'bg-black/20 hover:bg-black/30' : light ? 'hover:bg-white/10' : 'hover:bg-zen-black/5'
        }`}
      >
        {session.user.image ? (
          <Image
            src={session.user.image}
            alt={displayName}
            width={34}
            height={34}
            className={`w-[34px] h-[34px] rounded-full object-cover border-2 ${avatarRing}`}
            unoptimized={session.user.image.includes('res.cloudinary.com')}
          />
        ) : (
          <div className={`w-[34px] h-[34px] rounded-full flex items-center justify-center border-2 ${avatarRing} ${light ? 'bg-white/10' : 'bg-zen-black/5'}`}>
            <User size={16} className={light ? 'text-white/70' : 'text-zen-black/40'} strokeWidth={2} />
          </div>
        )}
        <div className="hidden lg:flex flex-col items-start leading-tight">
          <span className={`text-xs font-bold ${light ? 'text-white' : 'text-zen-black'}`}>{displayName}</span>
          <span className={`text-[8px] font-black uppercase tracking-[0.18em] ${light ? 'text-white/60' : 'text-zen-black/40'}`}>
            {session.user.role}
          </span>
        </div>
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 ${light ? 'text-white/60' : 'text-zen-black/40'} ${
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
