# Auth Implementation Guide — Dopamichi (RAG TripBot)

A step-by-step guide to add **NextAuth v5** (Google OAuth + Resend magic link) with role-based access control to the Dopamichi app.

This guide is tailored to the *current* state of `rag-tripbot`: Next.js 15, Prisma, Neon PostgreSQL + pgvector, driver adapter pattern, existing `User`/`Trip`/`LineContext` models, LINE bot integration, and three save flows (chat, gallery upload, templates).

> **Scope:** four roles — **non-member** (guest), **USER**, **ADMIN**, **SUPERADMIN**. Non-members can use all read/generate features; only members can save. Admins manage templates. Superadmins manage users.

---

## Table of Contents

- [0. Prisma v7 → v6 Downgrade (REQUIRED)](#0-prisma-v7--v6-downgrade-required)
- [1. Install Packages](#1-install-packages)
- [2. Google OAuth Setup Walkthrough](#2-google-oauth-setup-walkthrough)
- [3. Resend Setup Walkthrough](#3-resend-setup-walkthrough)
- [4. Environment Variables](#4-environment-variables)
- [5. Prisma Schema Changes](#5-prisma-schema-changes)
- [6. Migration + Seed (Templates + Superadmin)](#6-migration--seed)
- [7. NextAuth Configuration (`lib/auth.ts`)](#7-nextauth-configuration-libauthts)
- [8. NextAuth Route Handler](#8-nextauth-route-handler)
- [9. Middleware — Route Guards](#9-middleware--route-guards)
- [10. Session Provider](#10-session-provider)
- [11. Auth Pages (signin / verify-request / error)](#11-auth-pages)
- [12. Authorization Helpers (`lib/authz.ts`)](#12-authorization-helpers-libauthzts)
- [13. Protect Existing API Routes](#13-protect-existing-api-routes)
- [14. New API Routes (Admin + Public Templates)](#14-new-api-routes)
- [15. UI Changes](#15-ui-changes)
- [16. Admin Pages](#16-admin-pages)
- [17. LINE Bot — No Changes Needed](#17-line-bot--no-changes-needed)
- [18. Data Migration — Existing localStorage Trips](#18-data-migration--existing-localstorage-trips)
- [19. Phased Rollout Checklist](#19-phased-rollout-checklist)
- [20. Testing Checklist](#20-testing-checklist)
- [21. Common Gotchas](#21-common-gotchas)

---

## 0. Prisma v7 → v6 Downgrade (REQUIRED)

`@auth/prisma-adapter@2.11.1` (latest as of Oct 2025) only supports `@prisma/client` up to v6. Prisma v7 removed the old generator output location that the adapter imports from — so the official adapter is **broken on v7**. Resend (magic link) requires a database adapter, so we cannot escape via JWT-only.

**Downgrade to Prisma v6 (driver adapters are still fully GA in v6):**

```bash
npm uninstall prisma @prisma/client @prisma/adapter-pg @prisma/adapter-neon
npm install prisma@^6 @prisma/client@^6 @prisma/adapter-pg@^6
# Only if you use the Neon adapter anywhere:
npm install @prisma/adapter-neon@^6
```

Regenerate the client and verify:

```bash
npx prisma generate
npx prisma migrate status
npm run build
```

**What you lose:** Nothing. Your codebase uses standard Prisma CRUD + `$executeRaw` for pgvector — all identical between v6 and v7. The driver adapter instantiation pattern (`new PrismaClient({ adapter: new PrismaPg(...) })`) is the same.

**When to revisit v7:** Watch [nextauthjs/next-auth#13335](https://github.com/nextauthjs/next-auth/issues/13335). When the adapter ships v7 support, upgrade in one step.

Update `CLAUDE.md` and `architecture.md` to note: *"Prisma pinned at v6 until `@auth/prisma-adapter` supports v7."*

---

## 1. Install Packages

```bash
npm install next-auth@beta @auth/prisma-adapter resend
```

- `next-auth@beta` — Auth.js v5 (currently beta but production-ready)
- `@auth/prisma-adapter` — Prisma adapter for session/account/verification-token persistence
- `resend` — Resend SDK (required indirectly by the NextAuth Resend provider)

Verify:

```bash
npm ls next-auth @auth/prisma-adapter @prisma/client
# @prisma/client should be ^6.x
```

---

## 2. Google OAuth Setup Walkthrough

### 2.1 Create a Google Cloud Project

1. Go to https://console.cloud.google.com
2. Top bar → **Select a project** → **NEW PROJECT**
3. Name: `Dopamichi` → **Create**
4. After creation, select the new project in the top bar

### 2.2 Configure the OAuth Consent Screen

1. Left sidebar → **APIs & Services** → **OAuth consent screen**
2. Choose **External** → **Create**
3. Fill in:
   - **App name:** `Dopamichi`
   - **User support email:** `pongsatorn.kanja@gmail.com`
   - **App logo:** (optional — upload the dopamichi logo)
   - **Application home page:** `https://dopamichi.com`
   - **Application privacy policy:** `https://dopamichi.com/privacy`
   - **Application terms of service:** `https://dopamichi.com/terms`
   - **Authorized domains:** add `dopamichi.com`
   - **Developer contact:** `pongsatorn.kanja@gmail.com`
4. **Save and Continue** → **Scopes** → **Save and Continue** (defaults are fine)
5. **Test users** → add your own email(s) for dev testing → **Save and Continue**
6. Back on the consent screen, click **Publish App** → **Confirm** (moves from "Testing" to "In production" — required so any Google user can sign in)

### 2.3 Create OAuth 2.0 Client ID

1. Left sidebar → **APIs & Services** → **Credentials**
2. **+ CREATE CREDENTIALS** → **OAuth client ID**
3. **Application type:** `Web application`
4. **Name:** `Dopamichi Web Client`
5. **Authorized JavaScript origins:**
   - `http://localhost:3000`
   - `https://dopamichi.com`
6. **Authorized redirect URIs:**
   - `http://localhost:3000/api/auth/callback/google`
   - `https://dopamichi.com/api/auth/callback/google`
7. **Create**
8. Copy the **Client ID** and **Client secret** from the popup → save for `.env` (step 4)

---

## 3. Resend Setup Walkthrough

### 3.1 Create Account and API Key

1. Go to https://resend.com → **Sign up** (use your primary email)
2. After login: left sidebar → **API Keys** → **+ Create API Key**
3. Name: `Dopamichi Production` → **Permission:** `Sending access` → **Create**
4. Copy the key (`re_xxxxxxxxxxxxx`) — you can only see it once → save for `.env`

### 3.2 Verify a Sending Domain (Recommended for Production)

1. Left sidebar → **Domains** → **+ Add Domain**
2. Enter `dopamichi.com` → **Add**
3. Resend shows you a list of DNS records (MX, TXT, DKIM, SPF, DMARC)
4. Go to your domain registrar (wherever `dopamichi.com` DNS is managed) and add **all** the records shown
5. Back in Resend, click **Verify DNS Records** (may take 1–60 minutes to propagate)
6. Once verified, you can send from `noreply@dopamichi.com`, `hello@dopamichi.com`, etc.

### 3.3 Testing Fallback (Skip Domain Verification)

For local dev or before the domain is verified, use Resend's test sender:

```env
EMAIL_FROM="Dopamichi <onboarding@resend.dev>"
```

⚠️ The `onboarding@resend.dev` sender **only delivers to the email address you signed up with**. It will not deliver to random users. Verify your domain before launching.

---

## 4. Environment Variables

Append to `.env` (and add the same to Vercel project environment variables for production):

```env
# ── NextAuth ────────────────────────────────────────────────────────────────
AUTH_URL="http://localhost:3000"              # production: https://dopamichi.com
AUTH_SECRET=""                                # generate: openssl rand -base64 32
AUTH_TRUST_HOST=true                          # required on Vercel

# ── Google OAuth (from step 2.3) ────────────────────────────────────────────
GOOGLE_CLIENT_ID="xxxxxxxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="xxxxxxxx"

# ── Resend (from step 3.1) ──────────────────────────────────────────────────
RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxx"
EMAIL_FROM="Dopamichi <noreply@dopamichi.com>"   # or onboarding@resend.dev for testing

# ── Superadmin bootstrap ────────────────────────────────────────────────────
# Emails in this list are promoted to SUPERADMIN on first sign-in.
SUPERADMIN_EMAILS="pongsatorn.kanja@gmail.com"
```

Generate `AUTH_SECRET` once:

```bash
openssl rand -base64 32
```

---

## 5. Prisma Schema Changes

Edit `prisma/schema.prisma`. Below are the **additions and modifications** — keep your existing `LineContext` and pgvector-related setup as-is.

```prisma
// ── Add this enum ───────────────────────────────────────────────────────────
enum UserRole {
  USER
  ADMIN
  SUPERADMIN
}

// ── Replace the existing User model with this expanded version ──────────────
model User {
  id            String    @id @default(cuid())
  email         String?   @unique
  emailVerified DateTime?
  name          String?
  image         String?

  role          UserRole  @default(USER)

  trips         Trip[]
  templates     Template[]  @relation("TemplateAuthor")
  accounts      Account[]
  sessions      Session[]

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

// ── Replace the existing Trip model with this (add cascade + updatedAt) ─────
model Trip {
  id          String        @id @default(cuid())
  userId      String
  user        User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  title       String
  itinerary   Json
  shareCode   String?       @unique
  startDate   DateTime?
  source      String?       // 'chat' | 'template' | 'upload'
  templateId  String?       // if source='template', the Template this was saved from
  template    Template?     @relation(fields: [templateId], references: [id], onDelete: SetNull)
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  activeChats LineContext[]

  @@index([userId])
  @@index([templateId])
}

// ── NEW: Template model (replaces hardcoded templates in app/templates/page.tsx)
model Template {
  id          String   @id @default(cuid())
  title       String
  description String?
  itinerary   Json     // same Itinerary JSON shape as Trip.itinerary
  coverImage  String?  // URL or IMG.xxx key
  totalDays   Int
  season      String?
  published   Boolean  @default(true)
  createdById String
  createdBy   User     @relation("TemplateAuthor", fields: [createdById], references: [id])
  savedAs     Trip[]   // back-reference from Trip.template
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([createdById])
  @@index([published])
}

// ── NEW: NextAuth adapter models (required by @auth/prisma-adapter) ─────────
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

**Keep `LineContext` unchanged.** LINE bot continues to work purely off shareCodes.

---

## 6. Migration + Seed

### 6.1 Run the Migration

```bash
npx prisma migrate dev --name add_auth_and_templates
npx prisma generate
```

### 6.2 Seed: Migrate Hardcoded Templates + Bootstrap Superadmin

Create `prisma/seed-auth.ts`:

```ts
import { prisma } from '@/lib/db'

/**
 * Seeds the 4 originally-hardcoded templates into the Template table,
 * owned by the first SUPERADMIN (or a placeholder system user).
 *
 * Run with: npx tsx prisma/seed-auth.ts
 */
async function main() {
  const superEmail = 'pongsatorn.kanja@gmail.com'

  // 1. Ensure a system user exists to own the seed templates.
  //    This user will be auto-promoted to SUPERADMIN on first real sign-in.
  const systemUser = await prisma.user.upsert({
    where: { email: superEmail },
    update: { role: 'SUPERADMIN' },
    create: {
      email: superEmail,
      name: 'Pongsatorn (Superadmin)',
      role: 'SUPERADMIN',
    },
  })

  // 2. Copy the 4 hardcoded templates from app/templates/page.tsx.
  //    Paste the full itinerary JSON for each here.
  const templates = [
    {
      title: 'Tokyo & Osaka Classic',
      description: '7 days · Winter · ทริปคลาสสิกโตเกียว + โอซาก้า',
      totalDays: 7,
      season: 'Winter',
      coverImage: '', // TODO: set to IMG.xxx or URL
      itinerary: { /* paste from TEMPLATES[0] in app/templates/page.tsx */ },
    },
    // ... 3 more
  ]

  for (const t of templates) {
    await prisma.template.upsert({
      where: { id: `seed-${t.title}` }, // stable id so re-seeds are idempotent
      update: {},
      create: {
        id: `seed-${t.title}`,
        ...t,
        createdById: systemUser.id,
      },
    })
  }

  console.log(`✓ Seeded ${templates.length} templates, superadmin: ${superEmail}`)
}

main().finally(() => prisma.$disconnect())
```

Run it:

```bash
npx tsx prisma/seed-auth.ts
```

---

## 7. NextAuth Configuration (`lib/auth.ts`)

Create `lib/auth.ts`:

```ts
import NextAuth from 'next-auth'
import { encode as defaultEncode } from 'next-auth/jwt'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Google from 'next-auth/providers/google'
import Resend from 'next-auth/providers/resend'
import { prisma } from '@/lib/db'
import type { UserRole } from '@prisma/client'

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
    role: UserRole
  }
}

// ── Superadmin bootstrap list from env ──────────────────────────────────────
const SUPERADMIN_EMAILS = (process.env.SUPERADMIN_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
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
    Resend({
      apiKey: process.env.RESEND_API_KEY!,
      from: process.env.EMAIL_FROM || 'Dopamichi <onboarding@resend.dev>',
      maxAge: 5 * 60, // magic link valid for 5 minutes
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
  jwt: {
    // Strip JWT to only the fields we use — avoids HTTP 431 from large avatars.
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
    async jwt({ token, user, trigger, session }) {
      if (user) {
        return {
          sub: user.id,
          id: user.id as string,
          name: user.name,
          email: user.email,
          role: user.role,
        }
      }
      if (trigger === 'update' && session) {
        token.name = session.name ?? token.name
        token.role = session.role ?? token.role
      }
      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as UserRole
      }
      return session
    },

    async authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user
      const { pathname } = request.nextUrl
      const publicRoutes = [
        '/',
        '/auth/signin',
        '/auth/error',
        '/auth/verify-request',
        '/privacy',
        '/terms',
        '/support',
        '/about',
        '/maintenance',
        '/gallery',
        '/templates',
      ]
      if (publicRoutes.some((r) => pathname === r || pathname.startsWith(r + '/'))) return true
      if (!isLoggedIn) return false
      return true
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
```

### Why the custom `jwt.encode`?

Google profile pictures are huge data URIs. Without stripping, the session cookie blows past Vercel's 4 KB header limit → HTTP 431. This strip keeps the cookie small and predictable.

---

## 8. NextAuth Route Handler

Create `app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from '@/lib/auth'
export const { GET, POST } = handlers
```

That's it — Auth.js handles all OAuth and email callbacks through this single route.

---

## 9. Middleware — Route Guards

Create `middleware.ts` at the **project root** (not inside `app/`):

```ts
import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth
  const role = req.auth?.user?.role
  const pathname = nextUrl.pathname

  // API routes enforce their own auth via `await auth()` in each handler.
  if (pathname.startsWith('/api')) return NextResponse.next()

  // LINE webhook + LIFF views are always public (LINE bot is account-agnostic)
  if (pathname.startsWith('/liff')) return NextResponse.next()

  // Auth pages — logged-in users bounce back home
  if (pathname.startsWith('/auth')) {
    if (isLoggedIn) return NextResponse.redirect(new URL('/', nextUrl))
    return NextResponse.next()
  }

  // Admin routes — members with ADMIN or SUPERADMIN role only
  if (pathname.startsWith('/admin')) {
    if (!isLoggedIn) {
      const signInUrl = new URL('/auth/signin', nextUrl)
      signInUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(signInUrl)
    }
    if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
      return NextResponse.redirect(new URL('/', nextUrl))
    }
    // Superadmin-only subroutes
    if (pathname.startsWith('/admin/users') && role !== 'SUPERADMIN') {
      return NextResponse.redirect(new URL('/admin/dashboard', nextUrl))
    }
  }

  // Everything else is public (gallery, templates, chat, etc. — the app
  // purposefully lets non-members use read/generate features).
  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
```

---

## 10. Session Provider

Create `app/providers.tsx`:

```tsx
'use client'
import { SessionProvider } from 'next-auth/react'

export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
```

Wrap the root layout in `app/layout.tsx`:

```tsx
import Providers from './providers'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {/* existing Navbar, content, Footer */}
          {children}
        </Providers>
      </body>
    </html>
  )
}
```

---

## 11. Auth Pages

Three minimal pages matching the dopamichi zen-edition brand.

### 11.1 `app/auth/signin/page.tsx`

```tsx
'use client'
import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'

function SignInForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const params = useSearchParams()
  const callbackUrl = params.get('callbackUrl') ?? '/'

  async function handleGoogle() {
    setLoading('google')
    await signIn('google', { callbackUrl })
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setLoading('resend')
    await signIn('resend', { email, callbackUrl })
  }

  return (
    <main className="pt-[120px] pb-24 min-h-screen bg-briefing-cream px-8">
      <div className="max-w-md mx-auto space-y-10">
        <div className="text-center space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-basel-brick">Welcome</p>
          <h1 className="text-5xl font-black font-headline tracking-tighter text-zen-black italic">
            Sign in to dopamichi
          </h1>
          <p className="text-sm font-medium text-zen-black/60">
            เข้าสู่ระบบเพื่อบันทึกทริปและปลดล็อกฟีเจอร์สมาชิก
          </p>
        </div>

        <button
          onClick={handleGoogle}
          disabled={loading !== null}
          className="w-full py-4 border-2 border-zen-black font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black hover:text-briefing-cream transition-all disabled:opacity-40"
        >
          {loading === 'google' ? 'Signing in…' : 'Continue with Google'}
        </button>

        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-zen-black/10" />
          <span className="text-[9px] font-black uppercase tracking-widest text-zen-black/40">or</span>
          <div className="flex-1 h-px bg-zen-black/10" />
        </div>

        <form onSubmit={handleEmail} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="w-full bg-transparent border-b-2 border-zen-black py-3 font-medium text-sm focus:outline-none focus:border-basel-brick transition-colors"
          />
          <button
            type="submit"
            disabled={loading !== null || !email}
            className="w-full py-4 bg-basel-brick text-white font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black transition-all disabled:opacity-40"
          >
            {loading === 'resend' ? 'Sending link…' : 'Send me the email'}
          </button>
        </form>
      </div>
    </main>
  )
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  )
}
```

### 11.2 `app/auth/verify-request/page.tsx`

```tsx
export default function VerifyRequestPage() {
  return (
    <main className="pt-[120px] min-h-screen flex items-center justify-center bg-briefing-cream px-8">
      <div className="max-w-md text-center space-y-4">
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-basel-brick">Check your email</p>
        <h1 className="text-4xl font-black font-headline tracking-tighter text-zen-black italic">
          Magic link sent ✉️
        </h1>
        <p className="text-sm text-zen-black/60">
          เช็คอีเมลของคุณและคลิกลิงก์เพื่อเข้าสู่ระบบ (ลิงก์หมดอายุใน 5 นาที)
        </p>
      </div>
    </main>
  )
}
```

### 11.3 `app/auth/error/page.tsx`

```tsx
'use client'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

function ErrorContent() {
  const error = useSearchParams().get('error')
  return (
    <main className="pt-[120px] min-h-screen flex items-center justify-center bg-briefing-cream px-8">
      <div className="max-w-md text-center space-y-6">
        <h1 className="text-4xl font-black font-headline tracking-tighter text-zen-black italic">
          Authentication error
        </h1>
        <p className="text-sm text-zen-black/60">{error ?? 'Something went wrong.'}</p>
        <Link href="/auth/signin" className="inline-block px-6 py-3 bg-zen-black text-briefing-cream font-headline font-black text-xs uppercase tracking-[0.2em]">
          Try again
        </Link>
      </div>
    </main>
  )
}

export default function AuthErrorPage() {
  return <Suspense><ErrorContent /></Suspense>
}
```

---

## 12. Authorization Helpers (`lib/authz.ts`)

```ts
import type { UserRole } from '@prisma/client'
import { auth } from '@/lib/auth'

export function isAdminRole(role: UserRole | string | undefined | null): boolean {
  return role === 'ADMIN' || role === 'SUPERADMIN'
}

export function isSuperAdmin(role: UserRole | string | undefined | null): boolean {
  return role === 'SUPERADMIN'
}

/** Throws a 401-shaped response if not authenticated. Returns the session. */
export async function requireSession() {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
  return session
}

/** Throws a 403-shaped response if not ADMIN/SUPERADMIN. */
export async function requireAdmin() {
  const session = await requireSession()
  if (!isAdminRole(session.user.role)) {
    throw new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
  }
  return session
}

/** Throws a 403-shaped response if not SUPERADMIN. */
export async function requireSuperAdmin() {
  const session = await requireSession()
  if (!isSuperAdmin(session.user.role)) {
    throw new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
  }
  return session
}
```

---

## 13. Protect Existing API Routes

### 13.1 `app/api/trips/route.ts` — POST (save) + GET (list own trips)

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบเพื่อบันทึกทริป' }, { status: 401 })
  }

  const body = await req.json()
  const { title, itinerary, startDate, source, templateId } = body
  if (!title || !itinerary) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const trip = await prisma.trip.create({
    data: {
      userId: session.user.id,   // ← from session, NOT client input
      title,
      itinerary,
      startDate: startDate ? new Date(startDate) : null,
      source: source ?? null,
      templateId: templateId ?? null,
    },
  })

  return NextResponse.json({ trip })
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ trips: [] })
  }
  const trips = await prisma.trip.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ trips })
}
```

### 13.2 `app/api/trips/[id]/route.ts` — DELETE (owner or admin)

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { isAdminRole } from '@/lib/authz'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const trip = await prisma.trip.findUnique({ where: { id } })
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isOwner = trip.userId === session.user.id
  const isAdmin = isAdminRole(session.user.role)
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.trip.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
```

### 13.3 `app/api/activate/route.ts` — require session

Add at the top:

```ts
const session = await auth()
if (!session?.user?.id) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
// also verify the trip belongs to this user before generating a shareCode:
const trip = await prisma.trip.findUnique({ where: { id: tripId } })
if (!trip || trip.userId !== session.user.id) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

### 13.4 `app/api/upload/route.ts` — member-only (prevent VLM abuse)

```ts
const session = await auth()
if (!session?.user?.id) {
  return NextResponse.json(
    { error: 'กรุณาสมัครสมาชิกเพื่อใช้ฟีเจอร์ AI อ่านไฟล์' },
    { status: 401 }
  )
}
```

### 13.5 Leave public

- `app/api/chat/route.ts` — non-members can chat freely
- `app/api/trips/by-code/route.ts` — needed by LIFF + LINE, works off shareCode
- `app/api/line/webhook/route.ts` — LINE signature validation only, no session

---

## 14. New API Routes

### 14.1 `app/api/templates/route.ts` — public list

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const templates = await prisma.template.findMany({
    where: { published: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ templates })
}
```

### 14.2 `app/api/templates/[id]/save/route.ts` — member: heart/unheart

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

// Save a template → creates a Trip with source='template' + templateId
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: templateId } = await params
  const tmpl = await prisma.template.findUnique({ where: { id: templateId } })
  if (!tmpl) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Prevent duplicate saves
  const existing = await prisma.trip.findFirst({
    where: { userId: session.user.id, templateId },
  })
  if (existing) return NextResponse.json({ trip: existing, alreadySaved: true })

  const trip = await prisma.trip.create({
    data: {
      userId: session.user.id,
      title: tmpl.title,
      itinerary: tmpl.itinerary as object,
      source: 'template',
      templateId: tmpl.id,
    },
  })
  return NextResponse.json({ trip })
}

// Unsave = delete the Trip row that was created from this template
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: templateId } = await params
  await prisma.trip.deleteMany({
    where: { userId: session.user.id, templateId },
  })
  return NextResponse.json({ ok: true })
}
```

### 14.3 Admin routes — `app/api/admin/templates/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/authz'

export async function GET() {
  await requireAdmin()
  const templates = await prisma.template.findMany({
    include: { createdBy: { select: { email: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ templates })
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin()
  const body = await req.json()
  const { title, description, itinerary, coverImage, totalDays, season, published = true } = body

  const tmpl = await prisma.template.create({
    data: {
      title,
      description,
      itinerary,
      coverImage,
      totalDays,
      season,
      published,
      createdById: session.user.id,
    },
  })
  return NextResponse.json({ template: tmpl })
}
```

`app/api/admin/templates/[id]/route.ts` — PATCH / DELETE for admin edit/delete.

`app/api/admin/templates/from-trip/[tripId]/route.ts` — POST: "Promote to template" button. Copies a user's Trip into a new Template.

### 14.4 Admin routes — `app/api/admin/trips/route.ts`

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/authz'

export async function GET() {
  await requireAdmin()
  const trips = await prisma.trip.findMany({
    include: {
      user: { select: { email: true, name: true, role: true } },
      activeChats: { select: { lineId: true, sourceType: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ trips })
}
```

### 14.5 Superadmin routes — `app/api/admin/users/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/authz'

export async function GET() {
  await requireSuperAdmin()
  const users = await prisma.user.findMany({
    select: {
      id: true, email: true, name: true, role: true, createdAt: true,
      _count: { select: { trips: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ users })
}
```

`app/api/admin/users/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/authz'

// PATCH: change role (USER ↔ ADMIN). Cannot modify SUPERADMIN.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireSuperAdmin()
  const { id } = await params
  const { role } = await req.json()

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (target.role === 'SUPERADMIN') {
    return NextResponse.json({ error: 'Cannot modify a SUPERADMIN' }, { status: 403 })
  }
  if (role !== 'USER' && role !== 'ADMIN') {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const updated = await prisma.user.update({ where: { id }, data: { role } })
  return NextResponse.json({ user: updated })
}

// DELETE: cascade deletes trips, sessions, accounts. Cannot delete a SUPERADMIN.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSuperAdmin()
  const { id } = await params

  if (id === session.user.id) {
    return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 403 })
  }

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (target.role === 'SUPERADMIN') {
    return NextResponse.json({ error: 'Cannot delete a SUPERADMIN' }, { status: 403 })
  }

  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
```

---

## 15. UI Changes

### 15.1 Navbar — Sign in button / user menu

Replace the lone `User` icon in `app/components/Navbar.tsx` with a session-aware block:

```tsx
'use client'
import { useSession, signIn, signOut } from 'next-auth/react'
import Link from 'next/link'

function NavUserMenu() {
  const { data: session, status } = useSession()

  if (status === 'loading') return <div className="w-8 h-8" />

  if (!session?.user) {
    return (
      <button
        onClick={() => signIn()}
        className="text-xs font-black uppercase tracking-widest text-zen-black hover:text-basel-brick"
      >
        Sign in
      </button>
    )
  }

  const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'SUPERADMIN'

  return (
    <div className="flex items-center gap-4">
      {isAdmin && (
        <Link href="/admin/dashboard" className="text-[10px] font-black uppercase tracking-widest text-basel-brick">
          Admin
        </Link>
      )}
      <span className="text-xs font-bold text-zen-black/70 hidden md:inline">
        {session.user.name ?? session.user.email}
      </span>
      <button
        onClick={() => signOut({ callbackUrl: '/' })}
        className="text-[10px] font-black uppercase tracking-widest text-zen-black/60 hover:text-basel-brick"
      >
        Sign out
      </button>
    </div>
  )
}
```

Place `<NavUserMenu />` where the `User` icon currently sits.

### 15.2 Templates page — fetch from DB + heart icon

Replace the hardcoded `TEMPLATES` array in `app/templates/page.tsx` with a client fetch from `/api/templates`. Each template card shows a heart icon:

```tsx
import { Heart } from 'lucide-react'
import { useSession, signIn } from 'next-auth/react'

function TemplateCard({ template, savedIds, onToggle }: Props) {
  const { data: session } = useSession()
  const saved = savedIds.has(template.id)

  async function handleHeart(e: React.MouseEvent) {
    e.stopPropagation()
    if (!session) {
      signIn(undefined, { callbackUrl: '/templates' })
      return
    }
    const method = saved ? 'DELETE' : 'POST'
    await fetch(`/api/templates/${template.id}/save`, { method })
    onToggle(template.id, !saved)
  }

  return (
    <div className="relative ...">
      {/* existing card content */}
      <button onClick={handleHeart} className="absolute top-4 right-4">
        <Heart
          size={24}
          fill={saved ? '#B43325' : 'none'}
          stroke={saved ? '#B43325' : '#000'}
          strokeWidth={2}
        />
      </button>
    </div>
  )
}
```

On mount, fetch `/api/trips` to build a `Set` of `templateId` values the user has already saved.

### 15.3 Gallery page — two tabs (My Uploads / Saved Templates) + guest state

**Non-member state:** show a full-page CTA card:

```tsx
if (!session?.user) {
  return (
    <main className="pt-[120px] min-h-screen bg-briefing-cream px-8">
      <div className="max-w-2xl mx-auto text-center space-y-6 py-20">
        <h1 className="text-5xl font-black font-headline italic">Your Gallery</h1>
        <p className="text-zen-black/60">
          สมัครสมาชิกเพื่ออัปโหลดไฟล์ทริปของคุณและใช้ฟีเจอร์ AI แกะแพลนอัตโนมัติ
        </p>
        <p className="text-sm text-zen-black/50">
          Sign up to upload your own trip files and use our AI extraction feature.
        </p>
        <button onClick={() => signIn(undefined, { callbackUrl: '/gallery' })}
          className="px-8 py-4 bg-basel-brick text-white font-headline font-black text-xs uppercase tracking-[0.2em]">
          Sign up / Sign in
        </button>
      </div>
    </main>
  )
}
```

**Member state:** two tabs — "My Uploads" (`source='upload'`) and "Saved Templates" (`source='template'`). Uploads have a delete button; saved templates have an unsave (heart off) button that calls `DELETE /api/templates/:id/save`.

### 15.4 Chat save flow — login modal mid-flow

In `app/chat/page.tsx` (when re-enabled), change the "Confirm & Sync Itinerary" button:

```tsx
async function handleConfirm() {
  if (!session?.user) {
    signIn(undefined, { callbackUrl: '/chat' })
    // Optional: persist in-progress itinerary to sessionStorage so it's still there after redirect
    sessionStorage.setItem('pending_itinerary', JSON.stringify(latestItinerary))
    return
  }
  // ... existing save logic
}
```

On page load, check `sessionStorage` for `pending_itinerary` and auto-restore it.

### 15.5 Remove localStorage userId trick

Delete `getUserId()` and all `userId` field sends in client-side fetch calls — the API now reads identity from the session.

---

## 16. Admin Pages

### 16.1 `app/admin/dashboard/page.tsx`

A single-page dashboard with three sections:

1. **All Trips** — table from `/api/admin/trips` with columns: User email, Title, Source, Share code, Created at, Actions (Delete · Promote to Template)
2. **Templates** — grid from `/api/admin/templates` with: Edit · Delete · Published toggle
3. **Create Template** — form with title, description, season, totalDays, itinerary JSON (textarea), cover image URL, published checkbox

### 16.2 `app/admin/users/page.tsx` (SUPERADMIN only)

Table from `/api/admin/users`:

| Email | Name | Role | Trips | Created | Actions |
|---|---|---|---|---|---|
| ... | ... | USER/ADMIN/SUPERADMIN | count | date | Promote/Demote · Delete |

Buttons disabled on own row and on SUPERADMIN rows.

### 16.3 Minimal skeleton example

```tsx
// app/admin/dashboard/page.tsx
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { isAdminRole } from '@/lib/authz'
import AdminDashboardClient from './AdminDashboardClient'

export default async function AdminDashboardPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin?callbackUrl=/admin/dashboard')
  if (!isAdminRole(session.user.role)) redirect('/')
  return <AdminDashboardClient currentUser={session.user} />
}
```

The client component does the fetches and renders tabs.

---

## 17. LINE Bot — No Changes Needed

The LINE bot is intentionally account-agnostic:
- `/api/line/webhook` — validates LINE signature, no session
- `/api/trips/by-code` — public GET by shareCode, used by LIFF
- `LineContext` table binds `lineId → tripId` directly; no `userId` involved
- `/activate SHARECODE` command in LINE works without a website account

**Why this is correct:** You want itineraries to be shareable. If a user plans a trip for their family group, they paste the share code in the family LINE group and **any family member** (who may never visit dopamichi.com) can activate it. Gating LINE activation behind website auth would break this flow.

The only relevant change: admins can see LineContext data for moderation via the admin dashboard (trip detail view pulls in `activeChats`).

---

## 18. Data Migration — Existing localStorage Trips

Any trips created before auth was added have `userId` pointing to browser-generated UUIDs. These become orphans.

**Recommended approach (low risk):** Since current DB content is test data from development, simply delete it before deploying auth:

```sql
-- Run in Neon SQL editor or via Prisma Studio
DELETE FROM "LineContext";
DELETE FROM "Trip";
DELETE FROM "User";
```

Then re-seed templates (step 6.2).

**If you need to preserve a specific trip:** manually export it via Prisma Studio, then re-insert it under the superadmin's user ID after first sign-in.

---

## 19. Phased Rollout Checklist

> ✅ **Phases A–G completed 2026-04-09.** The checkboxes below are kept as
> historical record. See `CLAUDE.md` § Phase 5 and `docs/architecture.md`
> § Phase 5 for the final architecture summary. Only item NOT done: chat
> re-enable (deferred — `/chat → /maintenance` redirect still active).

Do these in order. Each phase is independently deployable and reversible.

### Phase A — Foundation (no user-facing changes)
- [ ] Downgrade Prisma v7 → v6 (step 0)
- [ ] Install `next-auth@beta @auth/prisma-adapter resend` (step 1)
- [ ] Create Google OAuth credentials (step 2)
- [ ] Create Resend account + API key (step 3)
- [ ] Add all env vars to `.env` (step 4)
- [ ] Update `prisma/schema.prisma` with new models + enum (step 5)
- [ ] `npx prisma migrate dev --name add_auth_and_templates`
- [ ] Run seed script (step 6.2)
- [ ] Verify migration + seed with `npx prisma studio`
- [ ] Commit: "chore: downgrade prisma v7→v6, add auth schema"

### Phase B — Auth wiring (sign-in works, nothing gated yet)
- [ ] Create `lib/auth.ts` (step 7)
- [ ] Create `app/api/auth/[...nextauth]/route.ts` (step 8)
- [ ] Create `middleware.ts` at project root (step 9)
- [ ] Create `app/providers.tsx` and wrap root layout (step 10)
- [ ] Create `app/auth/signin`, `verify-request`, `error` pages (step 11)
- [ ] Create `lib/authz.ts` helpers (step 12)
- [ ] Update Navbar with `NavUserMenu` (step 15.1)
- [ ] **Test:** sign in with Google → see name in navbar
- [ ] **Test:** sign in with email magic link → check inbox → click link → logged in
- [ ] **Test:** sign in with `pongsatorn.kanja@gmail.com` → Prisma Studio shows role=SUPERADMIN
- [ ] Commit: "feat(auth): add NextAuth v5 with Google + Resend magic link"

### Phase C — Gate existing features
- [ ] Update `/api/trips` POST/GET to use session (step 13.1)
- [ ] Update `/api/trips/[id]` DELETE with owner check (step 13.2)
- [ ] Update `/api/activate` with ownership check (step 13.3)
- [ ] Gate `/api/upload` behind session (step 13.4)
- [ ] Update gallery page with member/guest states (step 15.3)
- [ ] Remove `getUserId()` localStorage trick (step 15.5)
- [ ] **Test:** non-member visits `/gallery` → sees sign-up prompt
- [ ] **Test:** non-member tries to upload → redirected to signin
- [ ] **Test:** member uploads → trip saved, appears in "My Uploads" tab
- [ ] Commit: "feat(auth): gate save/upload/delete behind session"

### Phase D — Template system migration
- [ ] Create `/api/templates` GET (step 14.1)
- [ ] Create `/api/templates/[id]/save` POST/DELETE (step 14.2)
- [ ] Update `app/templates/page.tsx` to fetch from API + heart icon (step 15.2)
- [ ] **Test:** non-member clicks heart → redirected to signin
- [ ] **Test:** member hearts a template → appears in gallery "Saved Templates"
- [ ] **Test:** member un-hearts → removed
- [ ] Commit: "feat(templates): migrate to Template table with heart save/unsave"

### Phase E — Admin dashboard
- [ ] Create `/api/admin/trips` GET (step 14.4)
- [ ] Create `/api/admin/templates` CRUD (step 14.3)
- [ ] Create `/api/admin/templates/from-trip/[tripId]` POST
- [ ] Create `app/admin/dashboard/page.tsx` (step 16.1)
- [ ] **Test:** non-admin visits `/admin/dashboard` → redirected to `/`
- [ ] **Test:** admin views all trips, promotes a trip to template
- [ ] Commit: "feat(admin): dashboard for trips + templates management"

### Phase F — Superadmin user management
- [ ] Create `/api/admin/users` GET (step 14.5)
- [ ] Create `/api/admin/users/[id]` PATCH/DELETE (step 14.5)
- [ ] Create `app/admin/users/page.tsx` (step 16.2)
- [ ] **Test:** admin visits `/admin/users` → redirected to `/admin/dashboard`
- [ ] **Test:** superadmin promotes a user to admin → user can now access `/admin/dashboard`
- [ ] **Test:** superadmin tries to delete another superadmin → blocked
- [ ] Commit: "feat(admin): superadmin user management"

### Phase G — Hardening (rate limiting + final polish)

- [ ] Install Upstash: `npm install @upstash/ratelimit @upstash/redis`
- [ ] Verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in `.env` (already provisioned)
- [ ] Create `lib/rate-limit.ts` exporting an `authRateLimit` (e.g., 5 magic-link requests per 10 min per IP) and a `apiRateLimit` (e.g., 30 req/min per IP for `/api/upload`, `/api/chat`)
- [ ] Wrap the Resend `sendVerificationRequest` with the rate limiter — reject with 429 if over
- [ ] Wrap `/api/upload` and `/api/chat` with the API rate limiter
- [ ] Audit Resend dashboard logs for any abuse patterns
- [ ] Test: 6 magic link requests in a row from same IP → 6th should 429

### Phase H — Chat re-enable + final polish
- [ ] Remove `/chat → /maintenance` redirect in `next.config.ts`
- [ ] Re-enable AI Chat tab in navbar
- [ ] Wire chat save flow with login modal (step 15.4)
- [ ] Update `docs/architecture.md` + `CLAUDE.md` with auth system
- [ ] Final smoke test on staging
- [ ] Commit: "feat: re-enable chat with auth-gated save flow"

---

## 20. Testing Checklist

### Sign-in flows
- [ ] Google OAuth → land on `/`
- [ ] Email magic link → verify email → click → land on `/`
- [ ] Sign in from `/templates` → redirected back to `/templates` after auth
- [ ] Sign out → redirected to `/`

### Non-member (guest) flows
- [ ] Can visit `/`, `/chat`, `/templates`, `/gallery`, `/about`, `/privacy`, `/terms`, `/support`
- [ ] Can generate an itinerary in AI chat
- [ ] Can click "Save" → prompted to sign up
- [ ] Can browse templates but heart icon prompts sign up
- [ ] `/gallery` shows sign-up CTA
- [ ] Cannot access `/admin/*` (redirects to signin)

### Member (USER) flows
- [ ] Can save an itinerary from chat
- [ ] Can heart a template → appears in gallery "Saved Templates"
- [ ] Can upload a file in gallery → extracted + saved to "My Uploads"
- [ ] Can delete their own uploaded trip
- [ ] Can unsave a template (heart off)
- [ ] Cannot delete another user's trip (403)
- [ ] Cannot access `/admin/*`
- [ ] Generated `shareCode` works in LINE `/activate`

### Admin flows
- [ ] Can access `/admin/dashboard`
- [ ] Sees all trips from all users with user emails
- [ ] Can delete any user's trip (moderation)
- [ ] Can create a new template via form
- [ ] Can edit/delete/unpublish templates
- [ ] Can click "Promote to template" on a user trip → creates a Template
- [ ] Cannot access `/admin/users` (403 or redirect)

### Superadmin flows
- [ ] Everything admin can do
- [ ] Can access `/admin/users`
- [ ] Can promote USER → ADMIN
- [ ] Can demote ADMIN → USER
- [ ] Can delete a USER or ADMIN user (cascade deletes their trips)
- [ ] Cannot delete themselves
- [ ] Cannot delete another SUPERADMIN
- [ ] Cannot change another SUPERADMIN's role

### LINE bot (should be unchanged)
- [ ] `/activate TKY-XXX` in DM still works
- [ ] `/activate` in group still works
- [ ] `doma ...` trigger still gates group replies
- [ ] LIFF itinerary view still loads for anyone with a shareCode

---

## 21. Common Gotchas

- **HTTP 431 after Google sign-in** → The custom `jwt.encode` in `lib/auth.ts` already strips the picture. If you add fields later, keep the total stripped token under ~2 KB.
- **Resend magic link never arrives** → Check the Resend dashboard → Logs. If domain isn't verified, the test sender only delivers to your own signup email. Also check spam folder.
- **"Invalid redirect_uri" from Google** → The redirect URI in Google Cloud must match *exactly* — `http://localhost:3000/api/auth/callback/google` (no trailing slash, correct port).
- **`AUTH_TRUST_HOST` required on Vercel** → Without it, NextAuth rejects requests from the Vercel URL. Set `AUTH_TRUST_HOST=true` in Vercel env vars.
- **PrismaAdapter type error** → If TypeScript complains, cast: `adapter: PrismaAdapter(prisma) as any`. Known Auth.js v5 beta typing quirk.
- **Superadmin role not applied on first sign-in** → Verify the email in `SUPERADMIN_EMAILS` env var is lowercase and matches the Google account email exactly. The `createUser` event runs once per user row. If you missed it, manually update in Prisma Studio.
- **Role changes not reflected immediately** → JWT is cached. User must sign out + back in, or you can call `update({ role: 'ADMIN' })` from client via `useSession().update()`.
- **LINE bot suddenly broken after auth** → Check that `/api/line/webhook` and `/api/trips/by-code` are in the middleware's "always allow" paths (they're excluded by default since they're under `/api/*`).
- **Gallery delete fails with 403** → The Trip's `userId` must match `session.user.id`. If you migrated from localStorage UUIDs without reassigning ownership, old trips will be undeletable. Wipe + reseed (step 18).
- **Prisma v6 driver adapter warnings** → Driver adapters moved from "preview" to GA in 6.x. If you see preview feature warnings, check `schema.prisma` `generator client { previewFeatures = [...] }` — you can remove `"driverAdapters"` from the list since it's GA.
- **`@auth/prisma-adapter` peer warning about Prisma 6** → Expected. The peer range is `>=6` inclusive. Warning is safe to ignore.

---

## 22. File Layout Summary

```
rag-tripbot/
├─ prisma/
│  ├─ schema.prisma             # ← updated: User+role, Template, Account, Session, VerificationToken
│  └─ seed-auth.ts              # ← new: templates + superadmin seed
├─ lib/
│  ├─ auth.ts                   # ← new: NextAuth config
│  ├─ authz.ts                  # ← new: role helpers + require* guards
│  └─ db/index.ts               # unchanged (Prisma v6 client)
├─ middleware.ts                # ← new: route guards
├─ app/
│  ├─ providers.tsx             # ← new: SessionProvider
│  ├─ layout.tsx                # ← updated: wrap in <Providers>
│  ├─ api/
│  │  ├─ auth/[...nextauth]/route.ts    # ← new
│  │  ├─ trips/route.ts                 # ← updated: session-based
│  │  ├─ trips/[id]/route.ts            # ← updated: owner/admin check
│  │  ├─ activate/route.ts              # ← updated: ownership check
│  │  ├─ upload/route.ts                # ← updated: member-only
│  │  ├─ templates/route.ts             # ← new: public GET
│  │  ├─ templates/[id]/save/route.ts   # ← new: heart/unheart
│  │  └─ admin/
│  │     ├─ trips/route.ts              # ← new
│  │     ├─ templates/route.ts          # ← new
│  │     ├─ templates/[id]/route.ts     # ← new
│  │     ├─ templates/from-trip/[tripId]/route.ts  # ← new
│  │     ├─ users/route.ts              # ← new (SUPERADMIN)
│  │     └─ users/[id]/route.ts         # ← new (SUPERADMIN)
│  ├─ auth/
│  │  ├─ signin/page.tsx                # ← new
│  │  ├─ verify-request/page.tsx        # ← new
│  │  └─ error/page.tsx                 # ← new
│  ├─ admin/
│  │  ├─ dashboard/page.tsx             # ← new
│  │  └─ users/page.tsx                 # ← new (SUPERADMIN)
│  ├─ gallery/page.tsx                  # ← updated: guest state + 2 tabs
│  ├─ templates/page.tsx                # ← updated: fetch + heart icon
│  ├─ chat/page.tsx                     # ← updated: login modal mid-flow (when re-enabled)
│  └─ components/
│     └─ Navbar.tsx                     # ← updated: NavUserMenu
└─ .env                                 # ← updated: auth vars
```

---

## Done.

Once Phase A–G are all green on the testing checklist, the app has full RBAC, all features work for the right users, and the LINE bot continues humming along unchanged.

**Remember:** watch [nextauthjs/next-auth#13335](https://github.com/nextauthjs/next-auth/issues/13335). When Prisma v7 support lands in `@auth/prisma-adapter`, the v6→v7 re-upgrade is a one-liner.
