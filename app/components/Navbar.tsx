'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User, LogOut } from 'lucide-react'
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

        <NavUserMenu />
      </nav>
    </header>
  )
}

function NavUserMenu() {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return <div className="w-10 h-10" />
  }

  if (!session?.user) {
    return (
      <div className="flex items-center gap-4">
        <button
          onClick={() => signIn()}
          className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zen-black hover:text-basel-brick transition-colors"
        >
          <User size={20} strokeWidth={2} />
          <span className="hidden sm:inline">Sign in</span>
        </button>
      </div>
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
      <div className="hidden md:flex flex-col items-end leading-tight">
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
