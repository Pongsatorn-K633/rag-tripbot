import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { pushToLine } from '@/lib/line/client'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Look up all LineContexts linked to this trip
  const contexts = await prisma.lineContext.findMany({ where: { tripId: id } })

  // Notify each linked LINE user/group
  const NOTIFY_MSG =
    'แผนการเดินทางของคุณถูกลบจากระบบแล้ว 🗑️\nโปรด /activate รหัสใหม่เมื่อต้องการใช้งานอีกครั้ง'
  await Promise.allSettled(
    contexts.map((ctx) => pushToLine(ctx.lineId, NOTIFY_MSG).catch(() => null))
  )

  // Cascade delete (LineContexts first, then Trip)
  await prisma.lineContext.deleteMany({ where: { tripId: id } })
  await prisma.trip.delete({ where: { id } })

  return NextResponse.json({ ok: true, notified: contexts.length })
}
