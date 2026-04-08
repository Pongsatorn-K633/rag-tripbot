import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { isSuperAdmin } from '@/lib/authz'
import UsersAdmin from './UsersAdmin'

export const metadata = { title: 'User Management · dopamichi' }

export default async function AdminUsersPage() {
  const session = await auth()

  // Defense in depth — middleware already guards this route, but a server
  // check here prevents any routing edge case from slipping through.
  if (!session?.user) redirect('/auth/signin?callbackUrl=/admin/users')
  if (!isSuperAdmin(session.user.role)) redirect('/admin/dashboard')

  return (
    <UsersAdmin
      currentUser={{
        id: session.user.id,
        email: session.user.email,
        role: session.user.role,
      }}
    />
  )
}
