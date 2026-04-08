import type { UserRole } from '@prisma/client'
import { auth } from '@/lib/auth'

export function isAdminRole(role: UserRole | string | undefined | null): boolean {
  return role === 'ADMIN' || role === 'SUPERADMIN'
}

export function isSuperAdmin(role: UserRole | string | undefined | null): boolean {
  return role === 'SUPERADMIN'
}

/** Throws a 401 Response if not authenticated. Returns the session on success. */
export async function requireSession() {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return session
}

/** Throws 401 if not authenticated, 403 if not ADMIN/SUPERADMIN. */
export async function requireAdmin() {
  const session = await requireSession()
  if (!isAdminRole(session.user.role)) {
    throw new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return session
}

/** Throws 401 if not authenticated, 403 if not SUPERADMIN. */
export async function requireSuperAdmin() {
  const session = await requireSession()
  if (!isSuperAdmin(session.user.role)) {
    throw new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return session
}
