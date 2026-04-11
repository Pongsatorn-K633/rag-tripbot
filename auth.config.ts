import type { NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'
import type { UserRole } from '@prisma/client'

// Extend JWT + Session types for onboarding flag
declare module 'next-auth/jwt' {
  interface JWT {
    isOnboarded?: boolean
  }
}
declare module 'next-auth' {
  interface User {
    isOnboarded?: boolean
  }
}

/**
 * Edge-safe NextAuth config.
 *
 * This file is imported by `middleware.ts`, which runs on the Edge runtime.
 * It MUST NOT import anything that pulls in `pg`, `@prisma/client`, or any
 * other Node.js-only module. That means:
 *   ❌ no PrismaAdapter
 *   ❌ no `import { prisma } from '@/lib/db'`
 *   ❌ no Resend provider — it requires the adapter, which can't live here
 *
 * The full config (with adapter + Resend + db-reading callbacks) lives in
 * `lib/auth.ts` and extends this one via `{ ...authConfig, adapter, providers,
 * callbacks: {...} }`. Resend is added there.
 */
export const authConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // One email = one User row across both Google OAuth and Resend magic
      // link. Both providers verify email ownership so this is safe in
      // practice for a consumer app. The "dangerous" name is a warning that
      // strictly speaking an attacker who controlled the email at the
      // provider level could impersonate the user — but if that happens, all
      // bets are off anyway.
      allowDangerousEmailAccountLinking: true,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture ?? null,
          role: 'USER' as UserRole,
        }
      },
    }),
  ],
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
    verifyRequest: '/auth/verify-request',
  },
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    // These run in BOTH the edge middleware instance and the full Node-runtime
    // instance in lib/auth.ts. The full config's `jwt` callback overrides this
    // for first sign-in, but the edge instance needs its own minimal version
    // so `req.auth.user.role` is populated when decoding an existing cookie.
    //
    // Without the session callback below, middleware reads role=undefined and
    // incorrectly bounces SUPERADMINs away from /admin/* routes.
    async jwt({ token, user, trigger, session: updateSession }) {
      if (user) {
        const u = user as { id?: string; role?: UserRole; isOnboarded?: boolean }
        if (u.id) token.id = u.id
        if (u.role) token.role = u.role
        token.isOnboarded = u.isOnboarded ?? false
      }
      // Allow client update() calls to refresh isOnboarded after onboarding
      if (trigger === 'update' && updateSession) {
        const s = updateSession as { isOnboarded?: boolean }
        if (typeof s.isOnboarded === 'boolean') token.isOnboarded = s.isOnboarded
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? (token.sub as string)
        session.user.role = (token.role as UserRole) ?? 'USER'
        ;(session.user as { isOnboarded?: boolean }).isOnboarded = token.isOnboarded ?? false
      }
      return session
    },
    authorized({ auth }) {
      return !!auth
    },
  },
} satisfies NextAuthConfig
