import NextAuth from 'next-auth'
import { NextResponse } from 'next/server'
import { authConfig } from './auth.config'

// Use the edge-safe config — importing from `@/lib/auth` would pull in the
// Prisma adapter + `pg`, which are not supported in the Edge runtime.
const { auth } = NextAuth(authConfig)

/**
 * Route guards for the dopamichi app.
 *
 * - Public pages (/, /chat, /templates, /gallery, /about, /privacy, /terms,
 *   /support, /maintenance, /liff/*, /auth/*) are accessible to everyone
 * - /admin/* requires ADMIN or SUPERADMIN
 * - /admin/users/* requires SUPERADMIN
 * - API routes enforce their own auth via `await auth()` in each handler
 */
export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth
  const role = req.auth?.user?.role
  const pathname = nextUrl.pathname

  // API routes → each route handles its own auth
  if (pathname.startsWith('/api')) return NextResponse.next()

  // LIFF (LINE in-app views) → always public, account-agnostic
  if (pathname.startsWith('/liff')) return NextResponse.next()

  // /auth/* → if already logged in, bounce home
  if (pathname.startsWith('/auth')) {
    if (isLoggedIn) return NextResponse.redirect(new URL('/', nextUrl))
    return NextResponse.next()
  }

  // /admin/* → require ADMIN or SUPERADMIN
  if (pathname.startsWith('/admin')) {
    if (!isLoggedIn) {
      const signInUrl = new URL('/auth/signin', nextUrl)
      signInUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(signInUrl)
    }
    if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
      return NextResponse.redirect(new URL('/', nextUrl))
    }
    if (pathname.startsWith('/admin/users') && role !== 'SUPERADMIN') {
      return NextResponse.redirect(new URL('/admin/dashboard', nextUrl))
    }
  }

  // Everything else is public
  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
