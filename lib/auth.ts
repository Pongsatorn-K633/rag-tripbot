import NextAuth from 'next-auth'
import { encode as defaultEncode } from 'next-auth/jwt'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Resend from 'next-auth/providers/resend'
import { prisma } from '@/lib/db'
import type { UserRole } from '@prisma/client'
import { authConfig } from '../auth.config'

// ── Type augmentation ───────────────────────────────────────────────────────
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      image?: string | null
      role: UserRole
    }
  }
  interface User {
    role?: UserRole
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    role?: UserRole
  }
}

// ── Superadmin bootstrap list from env ──────────────────────────────────────
const SUPERADMIN_EMAILS = (process.env.SUPERADMIN_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

/**
 * Full NextAuth config — extends the edge-safe `authConfig` by adding the
 * Prisma adapter, JWT encode stripping, DB-backed JWT callback, and the
 * `createUser` event that bootstraps SUPERADMINs.
 *
 * This file is imported by:
 *   - `app/api/auth/[...nextauth]/route.ts`  (the HTTP handler)
 *   - `lib/authz.ts`                          (helpers)
 *   - any server component / API route that calls `auth()`
 *
 * It is NOT imported by `middleware.ts` (which uses `auth.config.ts` directly)
 * because the Prisma adapter pulls in `pg`, which isn't edge-compatible.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: PrismaAdapter(prisma) as any,
  // Merge edge-safe providers (Google) with adapter-requiring providers (Resend).
  providers: [
    ...authConfig.providers,
    Resend({
      apiKey: process.env.RESEND_API_KEY!,
      from: process.env.EMAIL_FROM || 'Dopamichi <onboarding@resend.dev>',
      maxAge: 5 * 60,
    }),
  ],
  jwt: {
    async encode({ token, secret, salt, maxAge }) {
      const stripped = token
        ? {
            sub: token.sub,
            id: token.id,
            name: token.name,
            email: token.email,
            role: token.role,
          }
        : {}
      return defaultEncode({ token: stripped, secret, salt, maxAge })
    },
  },
  callbacks: {
    ...authConfig.callbacks,

    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string
        token.role = (user as { role?: UserRole }).role ?? 'USER'
        return token
      }

      if (!token.role && token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email as string },
          select: { id: true, role: true },
        })
        if (dbUser) {
          token.id = dbUser.id
          token.role = dbUser.role
        }
      }

      if (trigger === 'update' && session) {
        const s = session as { name?: string; role?: UserRole }
        if (s.name) token.name = s.name
        if (s.role) token.role = s.role
      }

      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? (token.sub as string)
        session.user.role = (token.role as UserRole) ?? 'USER'
      }
      return session
    },
  },
  events: {
    async createUser({ user }) {
      if (user.email && SUPERADMIN_EMAILS.includes(user.email.toLowerCase())) {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: 'SUPERADMIN' },
        })
      }
    },
  },
  debug: process.env.NODE_ENV === 'development',
})
