import NextAuth from 'next-auth'
import { encode as defaultEncode } from 'next-auth/jwt'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Resend from 'next-auth/providers/resend'
import { prisma } from '@/lib/db'
import type { UserRole } from '@prisma/client'
import { authConfig } from '../auth.config'
import { authRateLimit, checkLimit } from './rate-limit'
import { Resend as ResendSDK } from 'resend'

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
 * Brand-matched HTML body for the magic link email. Minimal inline CSS
 * so it renders consistently in Gmail / Outlook / Apple Mail.
 */
function buildMagicLinkEmail(url: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F8F7F4;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <p style="font-size:10px;font-weight:900;letter-spacing:4px;text-transform:uppercase;color:#B43325;margin:0 0 8px;">Dopamichi</p>
      <h1 style="font-size:32px;font-weight:900;font-style:italic;color:#231A0E;margin:0;letter-spacing:-1px;">Sign in</h1>
    </div>
    <div style="background:#ffffff;padding:32px;border:1px solid rgba(35,26,14,0.1);">
      <p style="color:#231A0E;font-size:14px;line-height:1.7;margin:0 0 24px;">
        สวัสดีครับ 👋<br>
        คลิกปุ่มด้านล่างเพื่อเข้าสู่ระบบ dopamichi ลิงก์นี้จะหมดอายุใน 5 นาที
      </p>
      <p style="color:#231A0E;font-size:14px;line-height:1.7;margin:0 0 32px;">
        Hi there 👋<br>
        Click the button below to sign in to dopamichi. This link expires in 5 minutes.
      </p>
      <div style="text-align:center;margin:0 0 32px;">
        <a href="${url}" style="display:inline-block;padding:16px 40px;background:#B43325;color:#ffffff;text-decoration:none;font-size:12px;font-weight:900;letter-spacing:2px;text-transform:uppercase;">
          Sign in to dopamichi
        </a>
      </div>
      <p style="color:rgba(35,26,14,0.5);font-size:11px;line-height:1.6;margin:0 0 8px;">
        หรือคัดลอกลิงก์นี้ · Or copy this link:
      </p>
      <p style="color:rgba(35,26,14,0.7);font-size:11px;line-height:1.5;margin:0 0 24px;word-break:break-all;font-family:monospace;">
        ${url}
      </p>
      <div style="border-top:1px solid rgba(35,26,14,0.1);padding-top:16px;">
        <p style="color:rgba(35,26,14,0.4);font-size:10px;line-height:1.5;margin:0;">
          หากคุณไม่ได้ร้องขอการเข้าสู่ระบบ สามารถเพิกเฉยอีเมลนี้ได้<br>
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    </div>
    <p style="text-align:center;color:rgba(35,26,14,0.3);font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:24px 0 0;">
      dopamichi · zen edition v.01
    </p>
  </div>
</body>
</html>`
}

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
  adapter: PrismaAdapter(prisma),
  // Merge edge-safe providers (Google) with adapter-requiring providers (Resend).
  providers: [
    ...authConfig.providers,
    Resend({
      apiKey: process.env.RESEND_API_KEY!,
      from: process.env.EMAIL_FROM || 'Dopamichi <onboarding@resend.dev>',
      maxAge: 5 * 60,
      /**
       * Rate-limited + branded magic link sender. Replaces NextAuth's default
       * Resend send logic with a version that:
       *   1. Checks Upstash rate limit keyed by recipient email (5 / 10 min)
       *      to block spam and inbox enumeration
       *   2. Uses the official Resend SDK to send with a brand-matched HTML
       *      template (see buildMagicLinkEmail above)
       *
       * If the rate limit trips we throw — NextAuth shows that as an auth
       * error on /auth/error, which is better UX than silently skipping.
       */
      async sendVerificationRequest({ identifier: email, url, provider }) {
        const { success } = await checkLimit(
          authRateLimit,
          `magic-link:${email.toLowerCase()}`
        )
        if (!success) {
          throw new Error(
            'ขอ magic link บ่อยเกินไป กรุณารอ 10 นาทีแล้วลองใหม่ · ' +
              'Too many magic link requests. Please wait 10 minutes and try again.'
          )
        }

        const resend = new ResendSDK(provider.apiKey as string)
        const { error } = await resend.emails.send({
          from: (provider.from as string) ?? 'Dopamichi <onboarding@resend.dev>',
          to: email,
          subject: 'เข้าสู่ระบบ dopamichi · Sign in to dopamichi',
          html: buildMagicLinkEmail(url),
          text:
            `เข้าสู่ระบบ dopamichi / Sign in to dopamichi\n\n${url}\n\n` +
            'ลิงก์นี้จะหมดอายุใน 5 นาที · This link expires in 5 minutes.\n\n' +
            "หากคุณไม่ได้ร้องขอ สามารถเพิกเฉยอีเมลนี้ได้ · If you didn't request this, you can safely ignore this email.",
        })
        if (error) {
          console.error('[auth/resend] send failed:', error)
          throw new Error(`Email send failed: ${error.message}`)
        }
      },
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
