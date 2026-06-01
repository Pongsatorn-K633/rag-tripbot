import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { isAdminRole } from '@/lib/authz'
import { prisma } from '@/lib/db'
import { migrateV1toV2 } from '@/lib/trips/itinerary-model'
import type { AnyItinerary, TripAvailability } from '@/lib/itinerary-types'
import TripBuilder, { type BuilderInitial } from '../TripBuilder'

export const metadata = { title: 'Edit Trip · dopamichi' }

/** Edit an existing pre-planned template in the same node/slot builder used to create one.
 *  v1 templates are migrated to v2 on load so the slot editor can always render them. */
export default async function EditTripPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin?callbackUrl=/admin/dashboard')
  if (!isAdminRole(session.user.role)) redirect('/')

  const { id } = await params
  const tpl = await prisma.template.findUnique({ where: { id } })
  if (!tpl) notFound()

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
    days: v2.days ?? [],
  }

  return <TripBuilder initial={initial} />
}
