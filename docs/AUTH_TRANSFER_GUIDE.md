# Auth System Transfer Guide

A drop-in reference for replicating the **DayoffBuddy** authentication & authorization system in another Next.js project. Includes:

- NextAuth v5 (Auth.js) with **Prisma adapter**
- **Google OAuth** + **Resend email magic link** sign-in
- **JWT session strategy** with custom encode (cookie-size safe)
- Role-based access control: **SUPERADMIN / ADMIN / USER**
- Onboarding flow + middleware route guards
- Server-action authorization helpers

> Facebook OAuth is also wired in the source repo but optional. Drop the Facebook provider block if you don't need it.

---

## 1. Tech Stack & Versions

| Package | Version | Purpose |
|---|---|---|
| `next` | `15.1.0` | App Router |
| `react` | `19.0.0` | UI |
| `next-auth` | `5.0.0-beta.30` | Auth.js v5 |
| `@auth/prisma-adapter` | `2.11.1` | DB adapter |
| `@prisma/client` + `prisma` | `5.22.0` | ORM |
| `resend` | `6.9.1` | Email delivery |
| `typescript` | `5.x` | Types |

PostgreSQL database (Neon, Supabase, local — anything Prisma supports).

---

## 2. Install

```bash
npm install next-auth@beta @auth/prisma-adapter @prisma/client resend
npm install -D prisma
npx prisma init
```

---

## 3. Environment Variables

Create `.env.local`:

```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/dbname"

# NextAuth
AUTH_URL="http://localhost:3000"
AUTH_SECRET="generate-with: openssl rand -base64 32"

# Google OAuth — https://console.cloud.google.com
GOOGLE_CLIENT_ID="xxxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="xxxx"

# Resend — https://resend.com
RESEND_API_KEY="re_xxxxxxxx"
EMAIL_FROM="YourApp <noreply@yourdomain.com>"
```

**Google Console redirect URI:** `http://localhost:3000/api/auth/callback/google` (and your prod URL).

**Resend:** verify your sending domain, otherwise use the `onboarding@resend.dev` test sender.

---

## 4. Prisma Schema

`prisma/schema.prisma` — minimal version, only auth-relevant models:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  SUPERADMIN
  ADMIN
  USER
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified DateTime?
  name          String?
  image         String?

  role          UserRole  @default(USER)
  isOnboarded   Boolean   @default(false)

  accounts      Account[]
  sessions      Session[]

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

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

Then:

```bash
npx prisma migrate dev --name init
npx prisma generate
```

---

## 5. Prisma Client Singleton

`lib/prisma.ts`:

```ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

---

## 6. NextAuth Configuration (the heart of it)

`lib/auth.ts`:

```ts
import NextAuth from 'next-auth';
import { encode as defaultEncode } from 'next-auth/jwt';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Google from 'next-auth/providers/google';
import Resend from 'next-auth/providers/resend';
import { prisma } from '@/lib/prisma';
import type { UserRole } from '@prisma/client';

// Extend session/user types so TS knows about role + isOnboarded
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: UserRole;
      isOnboarded: boolean;
    };
  }

  interface User {
    role: UserRole;
    isOnboarded: boolean;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma) as any,
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
          image: null, // don't store the Google avatar in the DB
        } as any;
      },
    }),
    Resend({
      apiKey: process.env.RESEND_API_KEY!,
      from: process.env.EMAIL_FROM || 'YourApp <noreply@yourdomain.com>',
      maxAge: 2 * 60, // magic link valid for 2 minutes
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
    // Strip JWT down to ONLY the fields we use.
    // Avoids HTTP 431 (cookie too large) when providers stuff big avatar URLs in.
    async encode({ token, secret, salt, maxAge }) {
      const stripped = token
        ? {
            sub: token.sub,
            id: token.id,
            name: token.name,
            email: token.email,
            role: token.role,
            isOnboarded: token.isOnboarded,
          }
        : {};
      return defaultEncode({ token: stripped, secret, salt, maxAge });
    },
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // First sign-in: build a minimal token
      if (user) {
        return {
          sub: user.id,
          id: user.id as string,
          name: user.name,
          email: user.email,
          role: user.role,
          isOnboarded: user.isOnboarded,
        };
      }

      // Allow client `update()` calls to refresh token fields
      if (trigger === 'update' && session) {
        token.isOnboarded = session.isOnboarded ?? token.isOnboarded;
        token.name = session.name ?? token.name;
        token.role = session.role ?? token.role;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.isOnboarded = token.isOnboarded as boolean;
      }
      return session;
    },

    // Used by middleware via `auth((req) => …)`
    async authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;

      const publicRoutes = ['/', '/auth/signin', '/auth/error', '/auth/verify-request'];
      if (publicRoutes.some((r) => pathname === r)) return true;

      if (!isLoggedIn) return false;
      return true;
    },
  },
  events: {
    // Bootstrap SUPERADMIN by hard-coded email when the user row is created
    async createUser({ user }) {
      const superAdminEmails = ['you@yourdomain.com']; // <-- EDIT
      if (user.email && superAdminEmails.includes(user.email.toLowerCase())) {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: 'SUPERADMIN' },
        });
      }
    },
  },
  debug: process.env.NODE_ENV === 'development',
});
```

### Why the custom `jwt.encode`?

Some providers shove a massive `picture` data URI into the token. That bloats the session cookie and Next.js will throw **HTTP 431 Request Header Fields Too Large**. Stripping the token to only the fields you actually need avoids this entirely.

---

## 7. NextAuth Route Handler

`app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from '@/lib/auth';

export const { GET, POST } = handlers;
```

---

## 8. Middleware (Route Guards + Onboarding + Admin)

`middleware.ts` at the project root:

```ts
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const isOnboarded = req.auth?.user?.isOnboarded;

  const isAuthRoute = nextUrl.pathname.startsWith('/auth');
  const isOnboardingRoute = nextUrl.pathname === '/onboarding';
  const isDashboardRoute = nextUrl.pathname.startsWith('/dashboard');
  const isSettingsRoute = nextUrl.pathname.startsWith('/settings');
  const isAdminRoute = nextUrl.pathname.startsWith('/admin');
  const isApiRoute = nextUrl.pathname.startsWith('/api');

  if (isApiRoute) return NextResponse.next();

  // 1. Logged in but not onboarded → force /onboarding
  if (isLoggedIn && !isOnboarded && !isOnboardingRoute && !isAuthRoute) {
    return NextResponse.redirect(new URL('/onboarding', nextUrl));
  }

  // 2. Already onboarded → can't revisit /onboarding
  if (isLoggedIn && isOnboarded && isOnboardingRoute) {
    return NextResponse.redirect(new URL('/', nextUrl));
  }

  // 3. Logged in → can't visit /auth/*
  if (isLoggedIn && isAuthRoute) {
    return NextResponse.redirect(new URL(isOnboarded ? '/' : '/onboarding', nextUrl));
  }

  // 4. Not logged in → kick to sign-in with callback
  if (!isLoggedIn && (isDashboardRoute || isOnboardingRoute || isSettingsRoute || isAdminRoute)) {
    const signInUrl = new URL('/auth/signin', nextUrl);
    signInUrl.searchParams.set('callbackUrl', nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  // 5. /admin requires ADMIN or SUPERADMIN
  if (isLoggedIn && isAdminRoute) {
    const role = req.auth?.user?.role;
    if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
      return NextResponse.redirect(new URL('/', nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

---

## 9. Sign-In Page

`app/auth/signin/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState<string | null>(null);

  const handleGoogle = async () => {
    setLoading('google');
    await signIn('google', { callbackUrl: '/dashboard' });
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading('resend');
    await signIn('resend', { email, callbackUrl: '/dashboard' });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-center">Sign In</h1>

        <button
          onClick={handleGoogle}
          disabled={loading !== null}
          className="w-full px-4 py-3 border rounded-xl hover:bg-gray-50 disabled:opacity-50"
        >
          {loading === 'google' ? 'Signing in…' : 'Continue with Google'}
        </button>

        <div className="text-center text-sm text-gray-500">or</div>

        <form onSubmit={handleEmail} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-4 py-3 border rounded-xl"
            disabled={loading !== null}
          />
          <button
            type="submit"
            disabled={loading !== null || !email}
            className="w-full px-4 py-3 border rounded-xl hover:bg-gray-50 disabled:opacity-50"
          >
            {loading === 'resend' ? 'Sending link…' : 'Continue with Email'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

`app/auth/verify-request/page.tsx`:

```tsx
export default function VerifyRequestPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-bold mb-2">Check your email</h1>
        <p className="text-gray-600">A sign-in link has been sent. It expires in 2 minutes.</p>
      </div>
    </div>
  );
}
```

`app/auth/error/page.tsx`:

```tsx
'use client';
import { useSearchParams } from 'next/navigation';

export default function AuthErrorPage() {
  const params = useSearchParams();
  const error = params.get('error');
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Authentication Error</h1>
        <p className="text-gray-600">{error || 'Something went wrong.'}</p>
      </div>
    </div>
  );
}
```

---

## 10. Authorization Helpers

`lib/authz.ts`:

```ts
import type { UserRole } from '@prisma/client';

export function isAdminRole(role: string | undefined | null): boolean {
  return role === 'ADMIN' || role === 'SUPERADMIN';
}

export function isSuperAdmin(role: string | undefined | null): boolean {
  return role === 'SUPERADMIN';
}
```

### Use in **Server Components**:

```ts
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { isAdminRole } from '@/lib/authz';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin');
  if (!isAdminRole(session.user.role)) redirect('/');
  return <>{children}</>;
}
```

### Use in **Server Actions**:

```ts
'use server';
import { auth } from '@/lib/auth';
import { isAdminRole, isSuperAdmin } from '@/lib/authz';

export async function adminOnlyAction() {
  const session = await auth();
  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    return { success: false, error: 'Unauthorized' };
  }
  // …do the thing
}

export async function superAdminOnlyAction() {
  const session = await auth();
  if (!session?.user?.id || !isSuperAdmin(session.user.role)) {
    return { success: false, error: 'Unauthorized' };
  }
  // …do the thing
}
```

### Toggle ADMIN role (SUPERADMIN-only):

```ts
'use server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

export async function toggleAdminRole(userId: string) {
  const session = await auth();
  if (session?.user?.role !== 'SUPERADMIN') {
    return { success: false, error: 'Unauthorized' };
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { success: false, error: 'User not found' };
  if (target.role === 'SUPERADMIN') {
    return { success: false, error: 'Cannot modify a SUPERADMIN' };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role: target.role === 'ADMIN' ? 'USER' : 'ADMIN' },
  });
  return { success: true };
}
```

---

## 11. Onboarding Flow

The middleware forces users to `/onboarding` after sign-up until `isOnboarded === true`. A minimal page:

```tsx
// app/onboarding/page.tsx
'use client';
import { useSession } from 'next-auth/react';
import { completeOnboarding } from './actions';

export default function OnboardingPage() {
  const { update } = useSession();

  async function onSubmit(formData: FormData) {
    await completeOnboarding(formData);
    // refresh JWT so middleware sees isOnboarded=true
    await update({ isOnboarded: true });
    window.location.href = '/dashboard';
  }

  return (
    <form action={onSubmit}>
      <input name="name" placeholder="Display name" required />
      <button type="submit">Continue</button>
    </form>
  );
}
```

```ts
// app/onboarding/actions.ts
'use server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function completeOnboarding(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: formData.get('name') as string,
      isOnboarded: true,
    },
  });
}
```

After `update()`, the JWT callback's `trigger === 'update'` branch refreshes the token so middleware no longer redirects.

---

## 12. Session Provider for Client Components

`app/providers.tsx`:

```tsx
'use client';
import { SessionProvider } from 'next-auth/react';
export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

`app/layout.tsx`:

```tsx
import Providers from './providers';
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
```

Then in any client component:

```tsx
'use client';
import { useSession, signOut } from 'next-auth/react';

export function UserMenu() {
  const { data: session } = useSession();
  if (!session?.user) return null;
  return (
    <div>
      <span>{session.user.name} ({session.user.role})</span>
      <button onClick={() => signOut({ callbackUrl: '/' })}>Sign out</button>
    </div>
  );
}
```

---

## 13. Role Model — How It All Fits

| Role | How assigned | Can do |
|---|---|---|
| `USER` | Default for every new sign-up | Use the app |
| `ADMIN` | Toggled by a `SUPERADMIN` via `toggleAdminRole()` | Access `/admin/*` routes & admin server actions |
| `SUPERADMIN` | Hard-coded email in `events.createUser` | Everything ADMIN can + manage other users' roles |

**Promoting your first SUPERADMIN:**

1. Edit `superAdminEmails` in `lib/auth.ts` to include your email.
2. Sign in once with that email — the `createUser` event runs and promotes you.
3. Sign out and back in so the JWT picks up the new role.

If you signed in **before** editing the list, manually run:
```sql
UPDATE "User" SET role = 'SUPERADMIN' WHERE email = 'you@yourdomain.com';
```

---

## 14. File Layout Summary

```
your-project/
├─ prisma/
│  └─ schema.prisma
├─ lib/
│  ├─ auth.ts              # NextAuth config (the big one)
│  ├─ authz.ts             # isAdminRole / isSuperAdmin helpers
│  └─ prisma.ts            # Prisma singleton
├─ middleware.ts           # Route guards
├─ app/
│  ├─ api/auth/[...nextauth]/route.ts
│  ├─ auth/
│  │  ├─ signin/page.tsx
│  │  ├─ verify-request/page.tsx
│  │  └─ error/page.tsx
│  ├─ onboarding/
│  │  ├─ page.tsx
│  │  └─ actions.ts
│  ├─ admin/
│  │  └─ layout.tsx        # ADMIN/SUPERADMIN gate
│  ├─ providers.tsx        # SessionProvider
│  └─ layout.tsx
└─ .env.local
```

---

## 15. Checklist

- [ ] `npm install` the packages above
- [ ] Copy `prisma/schema.prisma` and run `prisma migrate dev`
- [ ] Create `.env.local` with all 6 env vars
- [ ] Copy `lib/auth.ts`, `lib/prisma.ts`, `lib/authz.ts`
- [ ] Copy `middleware.ts`
- [ ] Copy `app/api/auth/[...nextauth]/route.ts`
- [ ] Copy `app/auth/*` pages
- [ ] Copy `app/providers.tsx` and wrap `RootLayout`
- [ ] Edit the `superAdminEmails` array in `lib/auth.ts`
- [ ] Set up Google OAuth credentials & Resend domain
- [ ] Test: sign in with email → check inbox → click magic link → land on `/dashboard`
- [ ] Test: sign in with Google → land on `/dashboard`
- [ ] Test: visit `/admin` as USER → redirected to `/`
- [ ] Test: promote to ADMIN → re-sign-in → `/admin` accessible

---

## 16. Common Gotchas

- **HTTP 431 on sign-in** → the custom `jwt.encode` strip already fixes this. If you remove fields, keep `picture` out of the token.
- **Magic link expired** → `maxAge: 2 * 60` is intentionally tight. Bump it if 2 min is too short for your users.
- **Role not updating in UI after promotion** → call `useSession().update({ role: 'ADMIN' })` from the client, or have the user sign out and back in.
- **`allowDangerousEmailAccountLinking: true`** → enabled so a user signing in with Google + later with the same email via Resend gets linked to one User row. Only safe because all our providers verify email ownership.
- **Middleware doesn't run on API routes** → intentional, the middleware early-returns. Server actions enforce their own auth via `auth()` + `isAdminRole()`.
- **Prisma adapter type error** → cast with `as any` (`PrismaAdapter(prisma) as any`); a known v5 beta typing issue.

---

That's the whole system. Copy the files, set the env vars, edit the SUPERADMIN email — you're done.
