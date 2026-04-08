import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { isAdminRole } from '@/lib/authz'
import { pushToLine } from '@/lib/line/client'
import { getTripLockInfo } from '@/lib/trip-lock'

/**
 * DELETE /api/trips/:id
 * Deletes a trip. Allowed if:
 *   - the requester is the trip's owner, OR
 *   - the requester is an ADMIN / SUPERADMIN (moderation)
 * All linked LineContexts are notified and cascade-deleted.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const trip = await prisma.trip.findUnique({ where: { id } })
  if (!trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  }

  const isOwner = trip.userId === session.user.id
  const isAdmin = isAdminRole(session.user.role)
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Lock check — is this trip the source of a published template?
  const lockInfo = await getTripLockInfo(id)
  if (lockInfo.locked && lockInfo.lockedBy) {
    if (!isAdmin) {
      // User trying to delete their own promoted trip — refuse.
      return NextResponse.json(
        {
          error:
            'ทริปนี้ถูกเผยแพร่เป็นเทมเพลต ไม่สามารถลบได้ กรุณาติดต่อแอดมินผ่านหน้า /support · ' +
            'This trip has been published as a curated template and cannot be deleted. ' +
            "Please contact support via /support to request removal.",
          lockedByTemplate: lockInfo.lockedBy,
          contactUrl: '/support',
        },
        { status: 409 }
      )
    }

    // Admin override: null out the template's shareCode so the next dashboard
    // load auto-backfills a fresh code + bridge trip. This keeps the template
    // alive but signals it needs regeneration.
    await prisma.template.update({
      where: { id: lockInfo.lockedBy.id },
      data: { shareCode: null },
    })
  }

  // Notify any LINE chats bound to this trip before we nuke it.
  const contexts = await prisma.lineContext.findMany({ where: { tripId: id } })
  const NOTIFY_MSG =
    'แผนการเดินทางของคุณถูกลบจากระบบแล้ว 🗑️\nโปรด /activate รหัสใหม่เมื่อต้องการใช้งานอีกครั้ง'
  await Promise.allSettled(
    contexts.map((ctx) => pushToLine(ctx.lineId, NOTIFY_MSG).catch(() => null))
  )

  // Trip → LineContext has onDelete: Cascade, so this handles both rows.
  await prisma.trip.delete({ where: { id } })

  return NextResponse.json({
    ok: true,
    notified: contexts.length,
    templateReset: lockInfo.locked ? lockInfo.lockedBy : null,
  })
}
