'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { User, LogOut, Menu, X } from 'lucide-react'
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
    <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-zen-black/5">
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
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden text-zen-black/70 hover:text-basel-brick transition-colors"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X size={24} strokeWidth={2} /> : <Menu size={24} strokeWidth={2} />}
          </button>
        </div>
      </nav>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden border-t border-zen-black/5 bg-white/95 backdrop-blur-md">
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
    <div className="flex items-center gap-4">
      {isAdmin && (
        <Link
          href="/admin/dashboard"
          className="text-[10px] font-black uppercase tracking-widest text-basel-brick border border-basel-brick px-2 py-1 hover:bg-basel-brick hover:text-white transition-all"
        >
          Admin
        </Link>
      )}
      <div className="flex flex-col items-end leading-tight">
        <span className="text-xs font-bold text-zen-black">{displayName}</span>
        <span className="text-[8px] font-black uppercase tracking-widest text-zen-black/40">
          {session.user.role}
        </span>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: '/' })}
        title="Sign out"
        className="text-zen-black/60 hover:text-basel-brick transition-colors"
      >
        <LogOut size={20} strokeWidth={2} />
      </button>
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
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-zen-black">{displayName}</p>
          <p className="text-[9px] font-black uppercase tracking-widest text-zen-black/40">
            {session.user.role}
          </p>
        </div>
      </div>

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
        className="w-full py-3 border-2 border-zen-black text-zen-black font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black hover:text-white transition-all"
      >
        Sign out
      </button>
    </div>
  )
}
