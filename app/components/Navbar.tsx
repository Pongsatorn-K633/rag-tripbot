'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { User, LogOut, Menu, X, Settings, ChevronDown, Shield, Heart } from 'lucide-react'
import { useSession, signIn, signOut } from 'next-auth/react'
import { IMG } from '@/lib/images'

const TABS = [
  { id: 'home', label: 'Home', href: '/' },
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

/** Brand mark (mascot + "dopamichi"). `light` = white text (over the dark hero);
 *  otherwise dark. Rendered in the fixed bar (non-home) OR the page layer (home). */
function BrandLogo({ light, onClick }: { light: boolean; onClick?: () => void }) {
  return (
    <Link href="/" className="flex items-center rounded-full h-[46px] pl-1 pr-4" onClick={onClick}>
      <span className={`inline-flex items-center justify-center w-[34px] h-[34px] rounded-full ${light ? 'bg-briefing-cream' : ''}`}>
        <Image src={IMG.logo} alt="dopamichi logo" width={32} height={32} className="h-6 w-6 object-contain" unoptimized />
      </span>
      <span className={`ml-3 text-2xl font-headline font-bold tracking-tighter ${light ? 'text-white' : 'text-zen-black'}`}>
        dopamichi
      </span>
    </Link>
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
    <>
    {/* Home: the logo lives in the PAGE layer (absolute, NOT fixed) so it scrolls
        away with the hero instead of sticking to the nav. Other pages keep the
        logo in the fixed bar below. */}
    {isHome && (
      <div className="absolute top-0 left-0 z-[55] px-8 lg:px-12 py-6">
        <BrandLogo light onClick={() => setMobileOpen(false)} />
      </div>
    )}
    {/* Home: the desktop sign-in/profile also lives in the page layer so it
        scrolls away with the hero (mobile keeps its fixed hamburger below). */}
    {isHome && (
      <div className="hidden md:block absolute top-0 right-0 z-[55] px-8 lg:px-12 py-6">
        <NavUserMenu light={isHome} />
      </div>
    )}
    <header className={`fixed top-0 w-full z-50 transition-colors duration-300 ${isHome ? 'pointer-events-none' : ''} ${headerClass}`}>
      <nav className="relative flex justify-between items-center px-8 lg:px-12 py-6 w-full">
        {/* Left cluster — the fixed bar's logo. Invisible on home (the page-layer
            logo above is shown instead) but keeps the layout slot. */}
        <div className={`relative flex items-center shrink-0 ${isHome ? 'invisible' : ''}`}>
          <BrandLogo light={isHome} onClick={() => setMobileOpen(false)} />
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
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-briefing-cream shadow-sm transition-[width,height] duration-[400ms] ease-in-out"
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
          <div className={`hidden md:block ${isHome ? 'invisible' : ''}`}>
            <NavUserMenu light={isHome} />
          </div>
          {/* Mobile: page label + profile + hamburger. Hidden while the menu is
              open — the connected menu below provides its own X close tab. */}
          <div className="flex md:hidden items-center gap-2 pointer-events-auto">
            {!mobileOpen && (
              <>
                <MobilePageLabel />
                <MobileAvatar />
                <button
                  onClick={() => setMobileOpen(true)}
                  className={`transition-colors ${isHome ? 'text-white/80 hover:text-basel-brick' : 'text-zen-black/70 hover:text-basel-brick'}`}
                  aria-label="Open menu"
                >
                  <Menu size={24} strokeWidth={2} />
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile menu — CONNECTED to the X: a Cloud close-tab (rounded top) merges
          into the menu card via an inverted-radius concave corner, so the button
          and panel read as one continuous surface. */}
      {mobileOpen && (
        <div className="md:hidden absolute top-3 right-4 z-50 flex flex-col items-end pointer-events-auto drop-shadow-[0_16px_24px_rgba(0,0,0,0.3)]">
          {/* Close tab — sits where the hamburger was; flat bottom joins the card.
              -mb-px overlaps it into the card so there's no hairline seam. */}
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="relative z-10 -mb-px flex items-center justify-center w-12 h-12 bg-briefing-cream text-zen-black rounded-t-2xl"
          >
            <X size={22} strokeWidth={2} />
          </button>

          {/* Inverted-radius corner joining the tab's left side to the card top */}
          <span
            aria-hidden
            className="absolute right-11 top-[32px] z-0 h-4 w-5"
            style={{ background: 'radial-gradient(circle at top left, transparent 15.5px, var(--color-briefing-cream) 16px)' }}
          />

          {/* Card — top-right square so it butts flush against the tab */}
          <div className="relative w-fit min-w-[8rem] bg-briefing-cream rounded-2xl rounded-tr-none overflow-hidden">
            <div className="p-2.5 space-y-1">
              {TABS.map((tab) => (
                <Link
                  key={tab.id}
                  href={tab.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-3 py-2 rounded-lg font-headline font-bold text-lg transition-colors ${
                    isActive(tab.href)
                      ? 'text-basel-brick bg-basel-brick/10'
                      : 'text-zen-black/80 hover:bg-zen-black/5 hover:text-basel-brick'
                  }`}
                >
                  {tab.label}
                </Link>
              ))}

              {/* Divider + user menu */}
              <div className="border-t border-zen-black/10 mt-3 pt-3">
                <MobileUserMenu onClose={() => setMobileOpen(false)} />
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
    </>
  )
}

// ── Desktop user menu ────────────────────────────────────────────────────────

function NavUserMenu({ light = false }: { light?: boolean }) {
  const { data: session, status } = useSession()
  const [dropdownOpen, setDropdownOpen] = useState(false)

  if (status === 'loading') {
    return <div className="w-10 h-10" />
  }

  if (!session?.user) {
    return (
      <button
        onClick={() => signIn()}
        className={`group flex items-center gap-2.5 rounded-full h-[46px] pl-1 pr-4 transition-colors ${
          light ? 'hover:bg-white/10' : 'hover:bg-zen-black/5'
        }`}
      >
        <div className={`w-[34px] h-[34px] rounded-full flex items-center justify-center border-2 ${light ? 'border-white/40 bg-white/10' : 'border-zen-black/10 bg-zen-black/5'}`}>
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
        className={`group flex items-center gap-2.5 rounded-full h-[46px] pl-1 pr-2.5 transition-colors ${
          light ? 'hover:bg-white/10' : 'hover:bg-zen-black/5'
        }`}
      >
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
                  Admin Board
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
        className="group flex items-center gap-2.5 rounded-full h-11 pl-1 pr-4 hover:bg-zen-black/5 transition-colors"
      >
        <div className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center border-2 border-zen-black/10 bg-zen-black/5">
          <User size={16} className="text-zen-black/40" strokeWidth={2} />
        </div>
        <span className="text-sm font-bold text-zen-black">Sign in</span>
      </button>
    )
  }

  const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'SUPERADMIN'
  const displayName = session.user.name ?? session.user.email ?? 'User'

  // One consistent row: icon in a fixed left column, label after. Left-aligned.
  const rowCls =
    'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg font-headline font-bold text-sm text-zen-black/80 hover:bg-basel-brick/10 hover:text-basel-brick transition-colors'

  return (
    <div className="space-y-0.5">
      {/* User header */}
      <div className="flex items-center gap-2.5 px-3 pb-2">
        {session.user.image ? (
          <Image
            src={session.user.image}
            alt={displayName}
            width={36}
            height={36}
            className="w-9 h-9 shrink-0 rounded-full object-cover border-2 border-zen-black/10"
            unoptimized={session.user.image.includes('res.cloudinary.com')}
          />
        ) : (
          <div className="w-9 h-9 shrink-0 rounded-full bg-zen-black/5 flex items-center justify-center border-2 border-zen-black/10">
            <User size={18} className="text-zen-black/40" strokeWidth={2} />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-bold text-zen-black truncate">{displayName}</p>
          <p className="text-[9px] font-black uppercase tracking-widest text-basel-brick">{session.user.role}</p>
        </div>
      </div>

      <Link href="/saved" onClick={onClose} className={rowCls}>
        <Heart size={16} strokeWidth={2.2} className="shrink-0" />
        <span>Saved</span>
      </Link>
      <Link href="/settings" onClick={onClose} className={rowCls}>
        <Settings size={16} strokeWidth={2.2} className="shrink-0" />
        <span>Settings</span>
      </Link>
      {isAdmin && (
        <Link href="/admin/dashboard" onClick={onClose} className={rowCls}>
          <Shield size={16} strokeWidth={2.2} className="shrink-0" />
          <span>Admin Board</span>
        </Link>
      )}

      <div className="mt-1 pt-1 border-t border-zen-black/10">
        <button
          onClick={() => { signOut({ callbackUrl: '/' }); onClose() }}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg font-headline font-bold text-sm text-zen-black/50 hover:bg-zen-black/5 hover:text-zen-black transition-colors"
        >
          <LogOut size={16} strokeWidth={2.2} className="shrink-0" />
          <span>Sign out</span>
        </button>
      </div>
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
