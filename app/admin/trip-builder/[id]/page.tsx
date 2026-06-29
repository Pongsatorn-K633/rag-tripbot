import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { isAdminRole } from '@/lib/authz'
import { prisma } from '@/lib/db'
import { migrateV1toV2, isV3 } from '@/lib/trips/itinerary-model'
import type { AnyItinerary, ItineraryV3, TripAvailability } from '@/lib/itinerary-types'
import TripBuilder, { type BuilderInitial } from '../TripBuilder'
import TripBuilderV3 from '../TripBuilderV3'

export const metadata = { title: 'Edit Trip · dopamichi' }

/** Edit an existing pre-planned template. v3 (rich) templates load the v3 editor as-is;
 *  v1 templates are migrated to v2 so the legacy node/slot builder can always render them. */
export default async function EditTripPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin?callbackUrl=/admin/dashboard')
  if (!isAdminRole(session.user.role)) redirect('/')

  const { id } = await params
  const tpl = await prisma.template.findUnique({ where: { id } })
  if (!tpl) notFound()

  // v3 → rich editor, no migration (would mangle the v3 shape).
  if (isV3(tpl.itinerary)) {
    return (
      <TripBuilderV3
        initial={{
          id: tpl.id,
          shareCode: tpl.shareCode,
          published: tpl.published,
          itinerary: tpl.itinerary as unknown as ItineraryV3,
        }}
      />
    )
  }

  const v2 = migrateV1toV2(tpl.itinerary as unknown as AnyItinerary)
  const initial: BuilderInitial = {
    id: tpl.id,
    title: tpl.title,
    description: tpl.description,
    coverImage: tpl.coverImage,
    coverImages: tpl.coverImages ?? [],
    shareCode: tpl.shareCode,
    published: tpl.published,
    season: tpl.season,
    availability: (tpl.availability as unknown as TripAvailability | null) ?? null,
    airports: v2.airports ?? [],
    days: v2.days ?? [],
  }

  return <TripBuilder initial={initial} />
}
