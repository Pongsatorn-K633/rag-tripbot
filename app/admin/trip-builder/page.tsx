import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { isAdminRole } from '@/lib/authz'
import TripBuilder from './TripBuilder'

export const metadata = { title: 'Trip Builder · dopamichi' }

export default async function TripBuilderPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin?callbackUrl=/admin/trip-builder')
  if (!isAdminRole(session.user.role)) redirect('/')

  return <TripBuilder />
}
