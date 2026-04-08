'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Shield,
  ShieldOff,
  Trash2,
  User as UserIcon,
  Users,
  Crown,
  AlertCircle,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

type Role = 'USER' | 'ADMIN' | 'SUPERADMIN'

interface UserRow {
  id: string
  email: string | null
  name: string | null
  image: string | null
  role: Role
  createdAt: string
  updatedAt: string
  _count: {
    trips: number
    templates: number
    accounts: number
  }
}

interface CurrentUser {
  id: string
  email: string
  role: string
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function UsersAdmin({ currentUser }: { currentUser: CurrentUser }) {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadUsers() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load users')
      setUsers(data.users ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  async function handleRoleChange(user: UserRow, newRole: 'USER' | 'ADMIN') {
    const action = newRole === 'ADMIN' ? 'Promote to ADMIN' : 'Demote to USER'
    const msg =
      newRole === 'ADMIN'
        ? `Grant ADMIN access to ${user.email}?\n\nThey will be able to:\n• Manage all templates\n• See every user's trips\n• Delete trips (moderation)\n• Promote trips to templates`
        : `Revoke ADMIN access from ${user.email}?\n\nThey will become a regular USER and lose access to the admin dashboard.`

    if (!confirm(msg)) return
    setBusyId(user.id)
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `${action} failed`)
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u))
      )
    } catch (err) {
      alert(err instanceof Error ? err.message : `${action} failed`)
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(user: UserRow) {
    const confirmMsg =
      `⚠️ Permanently delete ${user.email}?\n\n` +
      `This will cascade delete:\n` +
      `• ${user._count.trips} trip(s)\n` +
      `• ${user._count.accounts} linked OAuth account(s)\n` +
      `• All LINE contexts\n` +
      `• All active sessions\n\n` +
      (user._count.templates > 0
        ? `Their ${user._count.templates} created template(s) will be reassigned to the system user.\n\n`
        : '') +
      `This action cannot be undone. Proceed?`

    if (!confirm(confirmMsg)) return

    // Double-confirm for extra safety
    const typed = prompt(
      `Type the email "${user.email}" to confirm deletion:`
    )
    if (typed !== user.email) {
      if (typed !== null) alert('Email did not match. Deletion cancelled.')
      return
    }

    setBusyId(user.id)
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Delete failed')
      setUsers((prev) => prev.filter((u) => u.id !== user.id))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusyId(null)
    }
  }

  const stats = {
    total: users.length,
    superadmins: users.filter((u) => u.role === 'SUPERADMIN').length,
    admins: users.filter((u) => u.role === 'ADMIN').length,
    users: users.filter((u) => u.role === 'USER').length,
  }

  return (
    <main className="pt-[120px] pb-24 min-h-screen bg-briefing-cream px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12 border-b border-zen-black/10 pb-8">
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-basel-brick">
              Superadmin · User Management
            </p>
            <h1 className="text-5xl md:text-6xl font-black font-headline tracking-tighter text-zen-black italic">
              Users
            </h1>
            <p className="text-sm font-medium text-zen-black/60">
              Signed in as <span className="font-bold text-zen-black">{currentUser.email}</span>
            </p>
          </div>
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zen-black/60 hover:text-basel-brick transition-colors self-start md:self-end"
          >
            <ArrowLeft size={14} strokeWidth={3} />
            Back to dashboard
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 mb-10 border border-zen-black">
          <StatCard icon={Users} label="Total" value={stats.total} />
          <StatCard icon={Crown} label="Superadmins" value={stats.superadmins} />
          <StatCard icon={Shield} label="Admins" value={stats.admins} />
          <StatCard icon={UserIcon} label="Users" value={stats.users} last />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-600 flex items-start gap-2">
            <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-red-700 mb-1">
                Load failed
              </p>
              <p className="text-xs text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="py-24 text-center text-zen-black/40 font-bold uppercase tracking-widest text-xs">
            Loading users...
          </div>
        ) : users.length === 0 ? (
          <div className="border-2 border-dashed border-zen-black/10 p-16 text-center">
            <p className="text-zen-black/40 font-sans text-lg">No users in the system.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-zen-black/10 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-zen-black">
                  <Th>User</Th>
                  <Th>Role</Th>
                  <Th>Trips</Th>
                  <Th>Templates</Th>
                  <Th>Joined</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isSelf = user.id === currentUser.id
                  const isSuper = user.role === 'SUPERADMIN'
                  const isBusy = busyId === user.id
                  const locked = isSelf || isSuper

                  return (
                    <tr
                      key={user.id}
                      className={`border-b border-zen-black/5 ${
                        isSelf ? 'bg-basel-brick/5' : 'hover:bg-briefing-cream/50'
                      }`}
                    >
                      <Td>
                        <div className="font-bold text-zen-black text-xs">
                          {user.email ?? '—'}
                          {isSelf && (
                            <span className="ml-2 text-[9px] font-black uppercase tracking-widest text-basel-brick">
                              You
                            </span>
                          )}
                        </div>
                        {user.name && (
                          <div className="text-[10px] text-zen-black/60 mt-0.5">
                            {user.name}
                          </div>
                        )}
                      </Td>
                      <Td>
                        <RoleBadge role={user.role} />
                      </Td>
                      <Td>
                        <span className="text-xs font-bold text-zen-black">
                          {user._count.trips}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-xs font-bold text-zen-black">
                          {user._count.templates}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-[11px] text-zen-black/60">
                          {new Date(user.createdAt).toLocaleDateString('en-GB')}
                        </span>
                      </Td>
                      <Td>
                        <div className="flex gap-1">
                          {/* Promote / Demote toggle */}
                          {user.role === 'USER' && (
                            <button
                              onClick={() => handleRoleChange(user, 'ADMIN')}
                              disabled={locked || isBusy}
                              title="Promote to ADMIN"
                              className="p-1.5 text-basel-brick hover:bg-basel-brick hover:text-white transition-colors disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-basel-brick"
                            >
                              <Shield size={14} strokeWidth={2.5} />
                            </button>
                          )}
                          {user.role === 'ADMIN' && (
                            <button
                              onClick={() => handleRoleChange(user, 'USER')}
                              disabled={locked || isBusy}
                              title="Demote to USER"
                              className="p-1.5 text-amber-700 hover:bg-amber-700 hover:text-white transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                            >
                              <ShieldOff size={14} strokeWidth={2.5} />
                            </button>
                          )}
                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(user)}
                            disabled={locked || isBusy}
                            title={
                              isSelf
                                ? 'Cannot delete yourself'
                                : isSuper
                                  ? 'Cannot delete a SUPERADMIN'
                                  : 'Delete user'
                            }
                            className="p-1.5 text-zen-black/40 hover:bg-red-600 hover:text-white transition-colors disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-zen-black/40"
                          >
                            <Trash2 size={14} strokeWidth={2.5} />
                          </button>
                        </div>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Notes */}
        <div className="mt-10 p-6 bg-white border border-zen-black/10 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-basel-brick">
            Superadmin rules
          </p>
          <ul className="text-xs text-zen-black/70 leading-relaxed space-y-1 list-disc pl-5">
            <li>Only users whose emails are listed in the <code className="font-mono bg-zen-black/5 px-1">SUPERADMIN_EMAILS</code> env var are auto-promoted to SUPERADMIN on their first sign-in. No API path to create a new SUPERADMIN.</li>
            <li>You <strong>cannot</strong> modify or delete another SUPERADMIN — prevents lockout and social engineering.</li>
            <li>You <strong>cannot</strong> modify or delete yourself — prevents accidental self-demotion.</li>
            <li>Deleting a user cascades to their trips, OAuth accounts, sessions, and LINE contexts. Any templates they created are reassigned to the system user (not deleted).</li>
          </ul>
        </div>
      </div>
    </main>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  last,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  label: string
  value: number
  last?: boolean
}) {
  return (
    <div className={`p-6 bg-white ${last ? '' : 'border-r border-zen-black'}`}>
      <Icon size={20} strokeWidth={1.5} className="text-basel-brick mb-4" />
      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-zen-black/50 mb-1">
        {label}
      </p>
      <p className="text-4xl font-black font-headline tracking-tighter text-zen-black">
        {value}
      </p>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-[0.2em] text-zen-black/60">
      {children}
    </th>
  )
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>
}

function RoleBadge({ role }: { role: Role }) {
  const styles: Record<Role, string> = {
    SUPERADMIN: 'bg-basel-brick text-white',
    ADMIN: 'bg-basel-brick/10 text-basel-brick border border-basel-brick/30',
    USER: 'bg-zen-black/5 text-zen-black/60',
  }
  return (
    <span
      className={`inline-block px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${styles[role]}`}
    >
      {role}
    </span>
  )
}
