import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

/**
 * PATCH /api/auth/onboarding
 * Sets the user's display name, profile image, and marks them as onboarded.
 * Called once from the /onboarding page after a new signup.
 *
 * Body: { name: string, image?: string }
 *
 * After this succeeds, the client calls `session.update({ isOnboarded: true })`
 * to refresh the JWT so middleware stops redirecting to /onboarding.
 */
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { name, image } = body as { name?: string; image?: string }

  if (!name || typeof name !== 'string' || name.trim().length < 1) {
    return NextResponse.json(
      { error: 'กรุณากรอกชื่อ · Name is required' },
      { status: 400 }
    )
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: name.trim(),
      image: image || null,
      isOnboarded: true,
    },
    select: {
      id: true,
      name: true,
      image: true,
      isOnboarded: true,
    },
  })

  return NextResponse.json({ user: updated })
}
