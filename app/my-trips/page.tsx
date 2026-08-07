import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getLockedTripIds } from '@/lib/trip-lock'
import MyTripsClient, { type SavedTrip } from './MyTripsClient'

export const metadata = {
  title: 'My Trips · dopamichi',
  description: 'ทริปของคุณ — แก้ไขได้อิสระ และใช้ share code เพื่อใช้งานบน LINE',
}

/**
 * /my-trips — SERVER component: the trips are queried here and handed to the
 * client as `initialTrips`, so the first paint already knows the answer.
 *
 * Why not fetch in the client (as it used to): the browser couldn't know
 * whether the user had any trips until /api/trips replied, so it had to guess
 * with placeholder cards — which flashed three fake trips at a brand-new user
 * before showing the empty state, and on a slow connection showed them for
 * seconds. Rendering on the server removes the guess entirely: a new user gets
 * the empty state immediately, an existing one gets real cards, no skeleton at
 * any connection speed. It's also one fewer round trip.
 *
 * Everything interactive (view modal, delete, LINE code, URL sync) stays in
 * MyTripsClient — this only supplies its initial data.
 *
 * GET /api/trips is untouched; it still serves the LIFF/other clients.
 */
export default async function MyTripsPage() {
  const session = await auth()

  let initialTrips: SavedTrip[] = []
  if (session?.user?.id) {
    const rows = await prisma.trip.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    })
    // Same `locked` annotation the API adds: a trip a published template points
    // at can't be deleted, and the UI hides its delete affordances.
    const lockedCodes = await getLockedTripIds(
      rows.map((t) => t.shareCode).filter((c): c is string => !!c),
    )
    // Dates → ISO strings: the client's SavedTrip carries strings, and only
    // plain JSON should cross the server/client boundary.
    initialTrips = rows.map((t) => ({
      id: t.id,
      title: t.title,
      createdAt: t.createdAt.toISOString(),
      itinerary: t.itinerary as unknown as SavedTrip['itinerary'],
      startDate: t.startDate ? t.startDate.toISOString() : null,
      source: t.source,
      shareCode: t.shareCode,
      templateId: t.templateId,
      coverImage: t.coverImage,
      locked: !!(t.shareCode && lockedCodes.has(t.shareCode)),
    }))
  }

  return (
    <MyTripsClient
      initialTrips={initialTrips}
      // The owner line on each card, and the signed-in/guest split — both known
      // here, so neither waits on useSession to hydrate.
      initialUser={
        session?.user
          ? { name: session.user.name, email: session.user.email, image: session.user.image }
          : null
      }
    />
  )
}
