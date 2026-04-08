import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { isAdminRole } from '@/lib/authz'
import Link from 'next/link'
import { Wrench, ArrowLeft } from 'lucide-react'

export const metadata = { title: 'Admin Dashboard · dopamichi' }

// Placeholder page for Phase E. The real dashboard will list all trips,
// manage templates, and expose "Promote to template" from any user trip.
// For now this just confirms the middleware + role guard are working.
export default async function AdminDashboardPage() {
  const session = await auth()

  // Defense in depth — middleware already guards /admin/*, but a server-side
  // check here prevents any edge case from slipping through.
  if (!session?.user) redirect('/auth/signin?callbackUrl=/admin/dashboard')
  if (!isAdminRole(session.user.role)) redirect('/')

  return (
    <main className="pt-[120px] pb-24 min-h-screen bg-briefing-cream px-8">
      <div className="max-w-3xl mx-auto space-y-10">
        <div className="space-y-3 border-b border-zen-black/10 pb-8">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-basel-brick">
            Admin · {session.user.role}
          </p>
          <h1 className="text-5xl md:text-6xl font-black font-headline tracking-tighter text-zen-black italic">
            Dashboard
          </h1>
          <p className="text-sm font-medium text-zen-black/60">
            Signed in as <span className="font-bold text-zen-black">{session.user.email}</span>
          </p>
        </div>

        <div className="border-2 border-dashed border-zen-black/20 p-10 text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-basel-brick/10 text-basel-brick rounded-full flex items-center justify-center">
              <Wrench size={28} strokeWidth={2} />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-headline font-black italic text-zen-black">
              Coming in Phase E
            </h2>
            <p className="text-sm text-zen-black/60 max-w-md mx-auto">
              The admin dashboard (view all trips, manage templates, promote user trips to templates) will be built in the next phase.
            </p>
            <p className="text-xs text-zen-black/40">
              For now, this page just confirms the auth role guard is working. ✨
            </p>
          </div>

          {session.user.role === 'SUPERADMIN' && (
            <div className="pt-4 border-t border-zen-black/10">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-basel-brick mb-3">
                Superadmin extras (Phase F)
              </p>
              <span className="inline-block px-4 py-2 border border-zen-black/20 text-xs text-zen-black/50">
                /admin/users — user management
              </span>
            </div>
          )}
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zen-black/60 hover:text-basel-brick transition-colors"
        >
          <ArrowLeft size={14} strokeWidth={3} />
          Back to site
        </Link>
      </div>
    </main>
  )
}
