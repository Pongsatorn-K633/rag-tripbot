import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { isAdminRole } from '@/lib/authz'
import NodesAdmin from './NodesAdmin'

export const metadata = { title: 'Node Library · dopamichi' }

export default async function NodesAdminPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin?callbackUrl=/admin/nodes')
  if (!isAdminRole(session.user.role)) redirect('/')

  return <NodesAdmin />
}
