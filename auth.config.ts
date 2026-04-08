import type { NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'
import type { UserRole } from '@prisma/client'

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
    // Minimal authorized callback used by the edge middleware. The real
    // route-level guards live in `middleware.ts` below this config.
    authorized({ auth }) {
      return !!auth
    },
  },
} satisfies NextAuthConfig
