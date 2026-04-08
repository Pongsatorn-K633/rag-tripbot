import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/authz'
import { generateShareCodeForTemplate, getSystemUserId } from '@/lib/share-code'

interface PromoteBody {
  description?: string
  coverImage?: string
  season?: string
  published?: boolean
}

interface ItineraryShape {
  title?: string
  totalDays?: number
  season?: string
  days?: unknown[]
}

/**
 * POST /api/admin/templates/from-trip/:tripId
 * Copies a user's Trip into a new Template row. Used by the "Promote to
 * template" action in the admin dashboard — admins can take a great user
 * upload or chat-generated itinerary and publish it for everyone.
 *
 * The resulting Template is attributed to the promoting admin (not the
 * original trip owner), so that edits + accountability live with staff.
 * The original Trip is unchanged — the user still owns their copy.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  let session
  try {
    session = await requireAdmin()
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }

  const { tripId } = await params
  const trip = await prisma.trip.findUnique({ where: { id: tripId } })
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

  const body = (await req.json().catch(() => ({}))) as PromoteBody
  const itinerary = trip.itinerary as ItineraryShape

  // Infer totalDays from the itinerary if not explicit. Fall back to days.length.
  const totalDays =
    (typeof itinerary?.totalDays === 'number' && itinerary.totalDays) ||
    (Array.isArray(itinerary?.days) ? itinerary.days.length : 1)

  const template = await prisma.template.create({
    data: {
      title: trip.title,
      description: body.description ?? null,
      itinerary: trip.itinerary as object,
      coverImage: body.coverImage ?? null,
      totalDays,
      season: body.season ?? itinerary?.season ?? null,
      published: body.published ?? true,
      createdById: session.user.id,
    },
  })

  // Share code strategy when promoting:
  //
  //   - If the source trip ALREADY has a shareCode (e.g. the user activated
  //     it via /api/activate during upload or chat save), REUSE it. The
  //     source trip itself becomes the LINE activation target — no new
  //     bridge trip is needed, because the existing trip already serves
  //     that role. This is what the user expects: "same trip, same code."
  //
  //   - If the source trip has no shareCode, mint a fresh one and create
  //     a system-owned bridge trip via the helper.
  try {
    if (trip.shareCode) {
      const updated = await prisma.template.update({
        where: { id: template.id },
        data: { shareCode: trip.shareCode },
      })
      template.shareCode = updated.shareCode
    } else {
      const systemUserId = await getSystemUserId()
      const shareCode = await generateShareCodeForTemplate(template.id, systemUserId)
      template.shareCode = shareCode
    }
  } catch (err) {
    console.error('[admin/templates/from-trip] share code setup failed:', err)
  }

  return NextResponse.json({ template })
}
