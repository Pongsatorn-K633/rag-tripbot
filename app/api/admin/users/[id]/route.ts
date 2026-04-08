import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/authz'
import { getSystemUserId } from '@/lib/share-code'

/**
 * PATCH /api/admin/users/:id
 * Change a user's role. Only USER ↔ ADMIN is allowed.
 * SUPERADMIN only.
 *
 * Hard rules:
 *   - Cannot modify a SUPERADMIN's role (prevents lockout)
 *   - Cannot promote anyone TO SUPERADMIN via API — that bootstrap only
 *     happens via the SUPERADMIN_EMAILS env var + events.createUser hook
 *     (see lib/auth.ts)
 *   - Cannot modify own role (prevents accidental self-demotion)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session
  try {
    session = await requireSuperAdmin()
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }

  const { id } = await params
  const body = await req.json()
  const { role } = body as { role?: string }

  if (id === session.user.id) {
    return NextResponse.json(
      { error: 'Cannot modify your own role' },
      { status: 403 }
    )
  }

  if (role !== 'USER' && role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Role must be either USER or ADMIN' },
      { status: 400 }
    )
  }

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (target.role === 'SUPERADMIN') {
    return NextResponse.json(
      { error: 'Cannot modify a SUPERADMIN' },
      { status: 403 }
    )
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { role },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  })

  return NextResponse.json({ user: updated })
}

/**
 * DELETE /api/admin/users/:id
 * Permanently delete a user. Cascade deletes their trips, sessions,
 * accounts, and saved templates. SUPERADMIN only.
 *
 * Hard rules:
 *   - Cannot delete yourself
 *   - Cannot delete another SUPERADMIN (prevents lockout + social engineering)
 *   - Cannot delete the system user (should never reach this check since
 *     the API route won't expose it in GET, but belt + suspenders)
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session
  try {
    session = await requireSuperAdmin()
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }

  const { id } = await params

  if (id === session.user.id) {
    return NextResponse.json(
      { error: 'Cannot delete yourself' },
      { status: 403 }
    )
  }

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (target.role === 'SUPERADMIN') {
    return NextResponse.json(
      { error: 'Cannot delete a SUPERADMIN' },
      { status: 403 }
    )
  }

  if (target.email === 'system@dopamichi.local') {
    return NextResponse.json(
      { error: 'Cannot delete the system user' },
      { status: 403 }
    )
  }

  // Template.createdBy has NO cascade rule (Restrict is the Prisma default),
  // so if the user created any templates we need to reassign them to the
  // system user before deletion, otherwise the FK constraint blocks us.
  // Trip / Session / Account / LineContext all cascade automatically.
  const systemUserId = await getSystemUserId()
  await prisma.template.updateMany({
    where: { createdById: id },
    data: { createdById: systemUserId },
  })

  await prisma.user.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
