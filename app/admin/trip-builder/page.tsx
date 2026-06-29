import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { isAdminRole } from '@/lib/authz'
import TripBuilderV3 from './TripBuilderV3'

export const metadata = { title: 'Trip Builder · dopamichi' }

/** Create a new pre-planned trip — now the rich v3 editor (in create mode).
 *  Editing existing v1/v2 templates still uses the legacy builder via the [id] route. */
export default async function TripBuilderPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin?callbackUrl=/admin/trip-builder')
  if (!isAdminRole(session.user.role)) redirect('/')

  return <TripBuilderV3 />
}
