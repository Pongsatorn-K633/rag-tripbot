import { randomInt } from 'crypto'
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

// Unambiguous uppercase alphabet for hand-typed codes: A–Z and 2–9 minus the
// look-alikes I, L, O, 0, 1. 31 symbols ⇒ 31^4 ≈ 920k codes per city prefix,
// so blind guessing is hopeless (vs. the old PREFIX-NNN = 900 per prefix).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_SUFFIX_LEN = 4

/**
 * Mint a single share code like `KYO-7F3K`. Crypto-random (not Math.random) —
 * share codes are bearer read-tokens for an itinerary, so the suffix must be
 * unpredictable, not just unique. Single source of truth for the format; both
 * template promotion and per-user `/api/activate` mint through here.
 */
export function randomShareCode(city: string): string {
  const prefix = city.slice(0, 3).toUpperCase() || 'JPN'
  let suffix = ''
  for (let i = 0; i < CODE_SUFFIX_LEN; i++) {
    suffix += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  }
  return `${prefix}-${suffix}`
}

/**
 * Mint a share code guaranteed unique across BOTH Trip.shareCode and
 * Template.shareCode (they share one unique namespace). Retries on collision.
 */
export async function generateUniqueShareCode(primaryCity: string): Promise<string> {
  let code = randomShareCode(primaryCity)
  while (
    (await prisma.trip.findUnique({ where: { shareCode: code } })) ||
    (await prisma.template.findUnique({ where: { shareCode: code } }))
  ) {
    code = randomShareCode(primaryCity)
  }
  return code
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

  const shareCode = await generateUniqueShareCode(primaryCity)

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
 * Keep the system-owned bridge Trip in sync with its template's content.
 *
 * The LINE bot and the LIFF itinerary view read the bridge Trip by `shareCode`,
 * so when an admin edits a template's itinerary/title/cover the bridge must be
 * updated too — otherwise `/activate` and the "ดูแผนเต็ม" / pre-planned cards
 * show stale content. Call this after any template content edit. No-op if the
 * template has no shareCode / bridge yet.
 *
 * Returns the number of bridge rows updated (0 or 1).
 */
export async function syncBridgeTrip(templateId: string): Promise<number> {
  const template = await prisma.template.findUnique({ where: { id: templateId } })
  if (!template?.shareCode) return 0

  const { count } = await prisma.trip.updateMany({
    where: { shareCode: template.shareCode, source: 'template' },
    data: {
      itinerary: template.itinerary as object,
      title: template.title,
      coverImage: template.coverImage,
    },
  })
  return count
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
