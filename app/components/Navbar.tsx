'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { User, LogOut, Menu, X, Settings, ChevronDown, Shield } from 'lucide-react'
import { useSession, signIn, signOut } from 'next-auth/react'
import { IMG } from '@/lib/images'

const TABS = [
  { id: 'home', label: 'Home', href: '/' },
  // AI Chat is under maintenance — disabled in nav, /chat redirects to /maintenance
  { id: 'chat', label: 'AI Chat', href: '/chat', disabled: true },
  { id: 'templates', label: 'Templates', href: '/templates' },
  { id: 'gallery', label: 'Gallery', href: '/gallery' },
]

export default function Navbar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Hide on liff routes only
  if (pathname.startsWith('/liff')) {
    return null
  }

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <header className="fixed top-0 w-full z-50 bg-briefing-cream/80 backdrop-blur-md border-b border-zen-black/5">
      <nav className="flex justify-between items-center px-8 py-6 w-full max-w-screen-2xl mx-auto">
        <Link
          href="/"
          className="flex items-center gap-3"
          onClick={() => setMobileOpen(false)}
        >
          <Image
            src={IMG.logo}
            alt="dopamichi logo"
            width={32}
            height={32}
            className="h-8 w-8 object-contain"
          />
          <span className="text-2xl font-headline font-bold tracking-tighter text-zen-black">
            dopamichi
          </span>
        </Link>

        {/* Desktop tabs */}
        <div className="hidden md:flex items-center gap-8 font-headline tracking-tight font-bold text-lg">
          {TABS.map((tab) =>
            tab.disabled ? (
              <span
                key={tab.id}
                title="Under maintenance · ปรับปรุงอยู่"
                className="pb-1 border-b-2 border-transparent text-zen-black/30 cursor-not-allowed select-none"
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
                  'transition-all duration-200 pb-1 border-b-2',
                  isActive(tab.href)
                    ? 'text-basel-brick border-basel-brick'
                    : 'text-zen-black opacity-70 hover:opacity-100 hover:text-basel-brick border-transparent',
                ].join(' ')}
              >
                {tab.label}
              </Link>
            )
          )}
        </div>

        {/* Right side: user menu (desktop) + hamburger (mobile) */}
        <div className="flex items-center gap-3">
          <div className="hidden md:block">
            <NavUserMenu />
          </div>
          {/* Mobile: profile picture + hamburger */}
          <div className="flex md:hidden items-center gap-2">
            <MobileAvatar />
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="text-zen-black/70 hover:text-basel-brick transition-colors"
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

function NavUserMenu() {
  const { data: session, status } = useSession()
  const [dropdownOpen, setDropdownOpen] = useState(false)

  if (status === 'loading') {
    return <div className="w-10 h-10" />
  }

  if (!session?.user) {
    return (
      <button
        onClick={() => signIn()}
        className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zen-black hover:text-basel-brick transition-colors"
      >
        <User size={20} strokeWidth={2} />
        <span>Sign in</span>
      </button>
    )
  }

  const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'SUPERADMIN'
  const displayName = session.user.name ?? session.user.email ?? 'User'

  return (
    <div className="relative">
      {/* Profile button — click to toggle dropdown */}
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
      >
        {session.user.image ? (
          <Image
            src={session.user.image}
            alt={displayName}
            width={32}
            height={32}
            className="w-8 h-8 rounded-full object-cover border-2 border-zen-black/10"
            unoptimized={session.user.image.includes('res.cloudinary.com')}
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-zen-black/5 flex items-center justify-center border-2 border-zen-black/10">
            <User size={16} className="text-zen-black/40" strokeWidth={2} />
          </div>
        )}
        <div className="flex flex-col items-start leading-tight">
          <span className="text-xs font-bold text-zen-black">{displayName}</span>
          <span className="text-[8px] font-black uppercase tracking-widest text-zen-black/40">
            {session.user.role}
          </span>
        </div>
        <ChevronDown
          size={14}
          className={`text-zen-black/40 transition-transform duration-200 ${
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
          <div className="absolute right-0 top-full mt-2 z-50 w-56 bg-briefing-cream border border-zen-black/10 shadow-xl py-2">
            {/* User info header */}
            <div className="px-4 py-3 border-b border-zen-black/5">
              <p className="text-xs font-bold text-zen-black truncate">{displayName}</p>
              <p className="text-[10px] text-zen-black/50 truncate">{session.user.email}</p>
            </div>

            {/* Menu items */}
            <div className="py-1">
              <Link
                href="/settings"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-zen-black/70 hover:bg-briefing-cream hover:text-zen-black transition-colors"
              >
                <Settings size={14} strokeWidth={2} />
                Settings · ตั้งค่า
              </Link>

              {isAdmin && (
                <Link
                  href="/admin/dashboard"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-basel-brick hover:bg-briefing-cream transition-colors"
                >
                  <Shield size={14} strokeWidth={2} />
                  Admin Dashboard
                </Link>
              )}
            </div>

            {/* Sign out */}
            <div className="border-t border-zen-black/5 pt-1">
              <button
                onClick={() => { signOut({ callbackUrl: '/' }); setDropdownOpen(false) }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-zen-black/50 hover:bg-briefing-cream hover:text-zen-black transition-colors"
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
