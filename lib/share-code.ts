import { prisma } from './db'

/**
 * Share code generation + LINE bridge setup.
 *
 * A share code is a short human-typeable identifier like `TKY-427` used by
 * the LINE bot's `/activate` command. In the data model, share codes live in
 * two places simultaneously:
 *
 *   1. `Template.shareCode` — the canonical code shown on every admin
 *      dashboard card. Same for all admins, fixed for the template's
 *      lifetime. Users never see this field directly.
 *
 *   2. A hidden "bridge" `Trip` row owned by the system user
 *      (`system@dopamichi.local`) with the **same** shareCode value. The
 *      LINE webhook looks up `Trip.shareCode` to find the itinerary, so
 *      the bridge keeps the existing LINE bot working without any schema
 *      or webhook changes — activating a template code binds the
 *      LineContext to this system-owned trip.
 *
 * This file is the single source of truth for minting codes and creating
 * the bridge trip. Call `generateShareCodeForTemplate()` whenever a
 * template is created, promoted, or seeded.
 */

function randomCode(city: string): string {
  const prefix = city.slice(0, 3).toUpperCase() || 'JPN'
  const number = Math.floor(100 + Math.random() * 900)
  return `${prefix}-${number}`
}

interface ItineraryShape {
  days?: Array<{ location?: string }>
}

/**
 * Generate a unique share code and ensure a system-owned bridge Trip exists
 * for LINE activation. Returns the final shareCode string.
 *
 * Idempotent: if the template already has a shareCode, returns it unchanged
 * (and ensures the bridge Trip still exists).
 *
 * @param templateId    The Template row to attach the code to
 * @param systemUserId  The id of the reserved system user that owns bridge Trips
 */
export async function generateShareCodeForTemplate(
  templateId: string,
  systemUserId: string
): Promise<string> {
  const template = await prisma.template.findUnique({ where: { id: templateId } })
  if (!template) throw new Error(`Template ${templateId} not found`)

  // Already has a code → make sure the bridge trip exists, return the code
  if (template.shareCode) {
    const bridge = await prisma.trip.findFirst({
      where: { shareCode: template.shareCode, userId: systemUserId },
    })
    if (!bridge) {
      await prisma.trip.create({
        data: {
          userId: systemUserId,
          title: template.title,
          itinerary: template.itinerary as object,
          source: 'template',
          templateId: template.id,
          coverImage: template.coverImage,
          shareCode: template.shareCode,
        },
      })
    }
    return template.shareCode
  }

  // Mint a new unique code — Trip.shareCode and Template.shareCode share the
  // same unique constraint space since they're both checked here.
  const itinerary = template.itinerary as ItineraryShape
  const primaryCity = itinerary?.days?.[0]?.location ?? 'JPN'

  let shareCode = randomCode(primaryCity)
  while (
    (await prisma.trip.findUnique({ where: { shareCode } })) ||
    (await prisma.template.findUnique({ where: { shareCode } }))
  ) {
    shareCode = randomCode(primaryCity)
  }

  // Create the bridge trip + update the template in one transaction
  await prisma.$transaction([
    prisma.trip.create({
      data: {
        userId: systemUserId,
        title: template.title,
        itinerary: template.itinerary as object,
        source: 'template',
        templateId: template.id,
        coverImage: template.coverImage,
        shareCode,
      },
    }),
    prisma.template.update({
      where: { id: templateId },
      data: { shareCode },
    }),
  ])

  return shareCode
}

/**
 * Fetch the system user's id (cached per request). Throws if the system user
 * doesn't exist — that should never happen in a healthy deployment since
 * prisma/seed-auth.ts always creates it first.
 */
export async function getSystemUserId(): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { email: 'system@dopamichi.local' },
    select: { id: true },
  })
  if (!user) {
    throw new Error(
      'System user (system@dopamichi.local) not found — run `npx tsx prisma/seed-auth.ts`'
    )
  }
  return user.id
}
