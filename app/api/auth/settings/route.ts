import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

/**
 * PATCH /api/auth/settings
 * Updates display name and/or profile image for an existing user.
 * Unlike /api/auth/onboarding, this does NOT set isOnboarded (it's already true).
 *
 * Body: { name?: string, image?: string | null }
 */
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { name, image } = body as { name?: string; image?: string | null }

  const data: Record<string, unknown> = {}

  if (typeof name === 'string') {
    const trimmed = name.trim()
    if (trimmed.length < 1) {
      return NextResponse.json(
        { error: 'กรุณากรอกชื่อ · Name cannot be empty' },
        { status: 400 }
      )
    }
    if (trimmed.length > 10) {
      return NextResponse.json(
        { error: 'ชื่อต้องไม่เกิน 10 ตัวอักษร · Name must be 10 characters or fewer' },
        { status: 400 }
      )
    }
    data.name = trimmed
  }

  if (image !== undefined) {
    data.image = image || null
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: {
      id: true,
      name: true,
      image: true,
    },
  })

  return NextResponse.json({ user: updated })
}
