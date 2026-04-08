import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { isAdminRole } from '@/lib/authz'
import AdminDashboard from './AdminDashboard'

export const metadata = { title: 'Admin Dashboard · dopamichi' }

export default async function AdminDashboardPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin?callbackUrl=/admin/dashboard')
  if (!isAdminRole(session.user.role)) redirect('/')

  return (
    <AdminDashboard
      currentUser={{
        id: session.user.id,
        email: session.user.email,
        role: session.user.role,
      }}
    />
  )
}
