'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Edit2, Trash2, TrendingUp, Users, FileText, BookOpen, X, Eye, EyeOff, Check, AlertCircle, Copy, Sparkles } from 'lucide-react'
import CoverUpload from '@/app/components/CoverUpload'
import { resolveCoverImage } from '@/lib/cover-image'

// ── Types ────────────────────────────────────────────────────────────────────

interface TripRow {
  id: string
  title: string
  source: string | null
  shareCode: string | null
  createdAt: string
  templateId: string | null
  user: { id: string; email: string | null; name: string | null; role: string }
  template: { id: string; title: string } | null
  activeChats: { lineId: string; sourceType: string; updatedAt: string }[]
  itinerary?: { totalDays?: number } | null
}

interface TemplateRow {
  id: string
  title: string
  description: string | null
  coverImage: string | null
  totalDays: number
  season: string | null
  published: boolean
  createdAt: string
  createdBy: { id: string; email: string | null; name: string | null }
  _count: { savedAs: number }
  /** Canonical LINE activation code for this template — same for all admins */
  shareCode: string | null
}

interface CurrentUser {
  id: string
  email: string
  role: string
}

type Tab = 'trips' | 'templates'

// ── Main component ───────────────────────────────────────────────────────────

export default function AdminDashboard({ currentUser }: { currentUser: CurrentUser }) {
  const [tab, setTab] = useState<Tab>('trips')
  const [trips, setTrips] = useState<TripRow[]>([])
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [promoteTripId, setPromoteTripId] = useState<string | null>(null)
  const [editTemplate, setEditTemplate] = useState<TemplateRow | null>(null)

  async function loadAll() {
    setLoading(true)
    try {
      const [tripsRes, templatesRes] = await Promise.all([
        fetch('/api/admin/trips'),
        fetch('/api/admin/templates'),
      ])
      if (tripsRes.ok) {
        const data = await tripsRes.json()
        setTrips(data.trips ?? [])
      }
      if (templatesRes.ok) {
        const data = await templatesRes.json()
        setTemplates(data.templates ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  async function handleDeleteTrip(id: string) {
    // Check if this trip is the source of a published template — if so,
    // show a stronger warning so the admin knows what happens downstream.
    const trip = trips.find((t) => t.id === id)
    const lockingTemplate = trip?.shareCode
      ? templates.find((t) => t.shareCode === trip.shareCode)
      : null

    const message = lockingTemplate
      ? `⚠️ This trip is the source of the published template "${lockingTemplate.title}".\n\n` +
        `Deleting it will null out the template's share code. A new code + bridge trip ` +
        `will be auto-generated on the next dashboard load.\n\n` +
        `Proceed with deletion?`
      : 'ลบแผนการเดินทางนี้? · Delete this trip permanently?'

    if (!confirm(message)) return
    const res = await fetch(`/api/trips/${id}`, { method: 'DELETE' })
    if (res.ok) {
      const data = await res.json()
      setTrips((prev) => prev.filter((t) => t.id !== id))
      if (data.templateReset) {
        alert(
          `Template "${data.templateReset.title}" lost its share code. ` +
            `Refreshing to regenerate...`
        )
        loadAll()
      }
    } else {
      const body = await res.json().catch(() => ({}))
      alert(body.error ?? 'Delete failed')
    }
  }

  async function handleDeleteTemplate(id: string) {
    if (!confirm('ลบเทมเพลตนี้? · Delete this template permanently?')) return
    const res = await fetch(`/api/admin/templates/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setTemplates((prev) => prev.filter((t) => t.id !== id))
    } else {
      alert('Delete failed')
    }
  }

  async function handleCleanupCovers() {
    if (!confirm('สแกนหาและล้าง cover image ที่ถูกลบจาก Cloudinary แล้วใช่ไหม?\nScan and clean stale Cloudinary cover references?')) return
    try {
      const res = await fetch('/api/admin/cleanup-covers', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Cleanup failed')
      alert(
        `Cleanup complete:\n` +
          `• Live Cloudinary assets: ${data.liveAssets}\n` +
          `• Templates cleaned: ${data.templatesCleaned}\n` +
          `• Trips cleaned: ${data.tripsCleaned}`
      )
      loadAll()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Cleanup failed')
    }
  }

  async function handleTogglePublished(tpl: TemplateRow) {
    const res = await fetch(`/api/admin/templates/${tpl.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published: !tpl.published }),
    })
    if (res.ok) {
      const { template } = await res.json()
      setTemplates((prev) => prev.map((t) => (t.id === tpl.id ? { ...t, ...template } : t)))
    }
  }


  const stats = {
    totalTrips: trips.length,
    totalTemplates: templates.length,
    publishedTemplates: templates.filter((t) => t.published).length,
    uniqueUsers: new Set(trips.map((t) => t.user.id)).size,
  }

  return (
    <main className="pt-[120px] pb-24 min-h-screen bg-briefing-cream px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12 border-b border-zen-black/10 pb-8">
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-basel-brick">
              Admin · {currentUser.role}
            </p>
            <h1 className="text-5xl md:text-6xl font-black font-headline tracking-tighter text-zen-black italic">
              Dashboard
            </h1>
            <p className="text-sm font-medium text-zen-black/60">
              Signed in as <span className="font-bold text-zen-black">{currentUser.email}</span>
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zen-black/60 hover:text-basel-brick transition-colors self-start md:self-end"
          >
            <ArrowLeft size={14} strokeWidth={3} />
            Back to site
          </Link>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 mb-12 border border-zen-black">
          <StatCard icon={FileText} label="Total Trips" value={stats.totalTrips} />
          <StatCard icon={Users} label="Unique Users" value={stats.uniqueUsers} />
          <StatCard icon={BookOpen} label="Templates" value={stats.totalTemplates} />
          <StatCard icon={TrendingUp} label="Published" value={stats.publishedTemplates} last />
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b-2 border-zen-black mb-10">
          <TabButton active={tab === 'trips'} onClick={() => setTab('trips')}>
            All Trips ({trips.length})
          </TabButton>
          <TabButton active={tab === 'templates'} onClick={() => setTab('templates')}>
            Templates ({templates.length})
          </TabButton>
          {currentUser.role === 'SUPERADMIN' && (
            <Link
              href="/admin/users"
              className="ml-auto px-6 py-4 text-[10px] font-black uppercase tracking-widest text-basel-brick hover:bg-basel-brick hover:text-white transition-all border-l border-zen-black"
            >
              Users →
            </Link>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="py-24 text-center text-zen-black/40 font-bold uppercase tracking-widest text-xs">
            Loading...
          </div>
        ) : tab === 'trips' ? (
          <TripsTable
            trips={trips}
            onDelete={handleDeleteTrip}
            onPromote={(id) => setPromoteTripId(id)}
          />
        ) : (
          <TemplatesGrid
            templates={templates}
            onCreate={() => setCreateOpen(true)}
            onEdit={(tpl) => setEditTemplate(tpl)}
            onDelete={handleDeleteTemplate}
            onTogglePublished={handleTogglePublished}
            onCleanupCovers={handleCleanupCovers}
          />
        )}

        {/* Create template modal */}
        {createOpen && (
          <TemplateFormModal
            mode="create"
            onClose={() => setCreateOpen(false)}
            onSaved={() => {
              setCreateOpen(false)
              loadAll()
            }}
          />
        )}

        {/* Edit template modal */}
        {editTemplate && (
          <TemplateFormModal
            mode="edit"
            template={editTemplate}
            onClose={() => setEditTemplate(null)}
            onSaved={() => {
              setEditTemplate(null)
              loadAll()
            }}
          />
        )}

        {/* Promote trip → template modal */}
        {promoteTripId && (
          <PromoteModal
            tripId={promoteTripId}
            trips={trips}
            onClose={() => setPromoteTripId(null)}
            onSaved={() => {
              setPromoteTripId(null)
              setTab('templates')
              loadAll()
            }}
          />
        )}
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
      <p className="text-4xl font-black font-headline tracking-tighter text-zen-black">{value}</p>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`px-6 py-4 text-xs font-black font-headline uppercase tracking-[0.2em] transition-all border-b-4 -mb-[2px] ${
        active
          ? 'text-basel-brick border-basel-brick'
          : 'text-zen-black/40 border-transparent hover:text-zen-black'
      }`}
    >
      {children}
    </button>
  )
}

function TripsTable({
  trips,
  onDelete,
  onPromote,
}: {
  trips: TripRow[]
  onDelete: (id: string) => void
  onPromote: (id: string) => void
}) {
  if (trips.length === 0) {
    return (
      <div className="border-2 border-dashed border-zen-black/10 p-16 text-center">
        <p className="text-zen-black/40 font-sans text-lg">No trips in the system yet.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto border border-zen-black/10 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-zen-black">
            <Th>Title</Th>
            <Th>User</Th>
            <Th>Source</Th>
            <Th>Share Code</Th>
            <Th>LINE</Th>
            <Th>Created</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {trips.map((t) => (
            <tr key={t.id} className="border-b border-zen-black/5 hover:bg-briefing-cream/50">
              <Td>
                <div className="font-bold text-zen-black">{t.title}</div>
                {t.template && (
                  <div className="text-[9px] uppercase tracking-widest text-basel-brick mt-0.5">
                    from: {t.template.title}
                  </div>
                )}
              </Td>
              <Td>
                <div className="text-xs">{t.user.email ?? '—'}</div>
                <div className="text-[9px] uppercase tracking-widest text-zen-black/40">
                  {t.user.role}
                </div>
              </Td>
              <Td>
                <SourceBadge source={t.source} />
              </Td>
              <Td>
                {t.shareCode ? (
                  <span className="font-mono text-xs bg-zen-black text-white px-2 py-0.5">
                    {t.shareCode}
                  </span>
                ) : (
                  <span className="text-zen-black/20">—</span>
                )}
              </Td>
              <Td>
                {t.activeChats.length > 0 ? (
                  <span className="text-[10px] font-bold text-green-600">
                    {t.activeChats.length} active
                  </span>
                ) : (
                  <span className="text-zen-black/20 text-xs">—</span>
                )}
              </Td>
              <Td>
                <span className="text-[11px] text-zen-black/60">
                  {new Date(t.createdAt).toLocaleDateString('en-GB')}
                </span>
              </Td>
              <Td>
                <div className="flex gap-2">
                  {t.source !== 'template' && (
                    <button
                      onClick={() => onPromote(t.id)}
                      title="Promote to template"
                      className="p-1.5 text-basel-brick hover:bg-basel-brick hover:text-white transition-colors"
                    >
                      <TrendingUp size={14} strokeWidth={2.5} />
                    </button>
                  )}
                  <button
                    onClick={() => onDelete(t.id)}
                    title="Delete"
                    className="p-1.5 text-zen-black/40 hover:bg-red-600 hover:text-white transition-colors"
                  >
                    <Trash2 size={14} strokeWidth={2.5} />
                  </button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
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

function SourceBadge({ source }: { source: string | null }) {
  const colors: Record<string, string> = {
    chat: 'bg-blue-100 text-blue-800',
    upload: 'bg-amber-100 text-amber-800',
    template: 'bg-basel-brick/10 text-basel-brick',
  }
  const label = source ?? 'unknown'
  return (
    <span
      className={`inline-block px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${
        colors[label] ?? 'bg-zen-black/5 text-zen-black/60'
      }`}
    >
      {label}
    </span>
  )
}

function TemplatesGrid({
  templates,
  onCreate,
  onEdit,
  onDelete,
  onTogglePublished,
  onCleanupCovers,
}: {
  templates: TemplateRow[]
  onCreate: () => void
  onEdit: (tpl: TemplateRow) => void
  onDelete: (id: string) => void
  onTogglePublished: (tpl: TemplateRow) => void
  onCleanupCovers: () => void
}) {
  return (
    <div>
      <div className="flex justify-end gap-3 mb-6">
        <button
          onClick={onCleanupCovers}
          className="inline-flex items-center gap-2 px-5 py-3 border-2 border-zen-black font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black hover:text-white transition-all"
          title="Scan DB for Cloudinary URLs that no longer exist and null them out"
        >
          <Sparkles size={14} strokeWidth={3} />
          Clean stale covers
        </button>
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-2 px-5 py-3 bg-basel-brick text-white font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black transition-all"
        >
          <Plus size={14} strokeWidth={3} />
          New Template
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="border-2 border-dashed border-zen-black/10 p-16 text-center">
          <p className="text-zen-black/40 font-sans text-lg">No templates yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((tpl) => (
            <div key={tpl.id} className="bg-white border border-zen-black/10 p-5 flex flex-col">
              {(
                <div className="relative aspect-[16/10] overflow-hidden mb-4 bg-briefing-cream">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt={tpl.title} src={resolveCoverImage(tpl.coverImage, tpl.id)} className="w-full h-full object-cover" />
                  {!tpl.published && (
                    <div className="absolute inset-0 bg-zen-black/60 flex items-center justify-center">
                      <span className="text-[10px] font-black uppercase tracking-widest text-white bg-basel-brick px-3 py-1">
                        Unpublished
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-headline font-bold text-lg text-zen-black leading-tight">
                  {tpl.title}
                </h3>
                <div className="flex gap-1 flex-shrink-0">
                  <span className="text-[9px] font-black uppercase tracking-widest bg-basel-brick/10 text-basel-brick px-2 py-0.5">
                    {tpl.totalDays}D
                  </span>
                </div>
              </div>

              {tpl.description && (
                <p className="text-xs text-zen-black/60 leading-relaxed mb-3 line-clamp-2">
                  {tpl.description}
                </p>
              )}

              <div className="flex items-center gap-3 text-[10px] font-bold text-zen-black/40 uppercase tracking-widest mb-3">
                <span>{tpl.season ?? ''}</span>
                <span>·</span>
                <span>{tpl._count.savedAs} saves</span>
              </div>

              {/* Canonical share code — always present. Click copies the
                  full `/activate TKY-427` command to the clipboard, ready
                  to paste in LINE. */}
              {tpl.shareCode && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`/activate ${tpl.shareCode}`)
                  }}
                  title="Copy /activate command"
                  className="w-full mb-3 flex items-center justify-between gap-2 px-3 py-2 bg-zen-black text-white hover:bg-basel-brick transition-colors group"
                >
                  <div className="flex flex-col items-start leading-tight">
                    <span className="text-[8px] font-black uppercase tracking-widest text-white/50">
                      Share code
                    </span>
                    <span className="font-mono text-sm font-bold">{tpl.shareCode}</span>
                  </div>
                  <Copy size={14} className="text-white/60 group-hover:text-white" />
                </button>
              )}

              <div className="mt-auto pt-3 border-t border-zen-black/10 flex items-center justify-between gap-2">
                <span className="text-[9px] text-zen-black/40 truncate">
                  {tpl.createdBy.email ?? 'system'}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => onTogglePublished(tpl)}
                    title={tpl.published ? 'Unpublish' : 'Publish'}
                    className="p-1.5 text-zen-black/60 hover:text-basel-brick transition-colors"
                  >
                    {tpl.published ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button
                    onClick={() => onEdit(tpl)}
                    title="Edit"
                    className="p-1.5 text-zen-black/60 hover:text-basel-brick transition-colors"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => onDelete(tpl.id)}
                    title="Delete"
                    className="p-1.5 text-zen-black/60 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Template form modal (create + edit share the same form) ─────────────────

function TemplateFormModal({
  mode,
  template,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit'
  template?: TemplateRow
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(template?.title ?? '')
  const [description, setDescription] = useState(template?.description ?? '')
  const [totalDays, setTotalDays] = useState(template?.totalDays?.toString() ?? '')
  const [season, setSeason] = useState(template?.season ?? 'Winter')
  const [coverImage, setCoverImage] = useState<string | null>(template?.coverImage ?? null)
  const [itineraryJson, setItineraryJson] = useState('')
  const [published, setPublished] = useState(template?.published ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // For edit mode, we need the full itinerary JSON. Since the admin list
    // doesn't include it, fetch from the public endpoint.
    if (mode === 'edit' && template) {
      fetch('/api/templates')
        .then((r) => r.json())
        .then((data) => {
          const full = data.templates?.find((t: { id: string }) => t.id === template.id)
          if (full?.itinerary) {
            setItineraryJson(JSON.stringify(full.itinerary, null, 2))
          }
        })
        .catch(() => null)
    }
  }, [mode, template])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    let itinerary
    try {
      itinerary = JSON.parse(itineraryJson)
    } catch {
      setError('Itinerary JSON is invalid. Please check the syntax.')
      return
    }

    setSaving(true)
    try {
      const url =
        mode === 'create' ? '/api/admin/templates' : `/api/admin/templates/${template?.id}`
      const method = mode === 'create' ? 'POST' : 'PATCH'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: description || null,
          totalDays: parseInt(totalDays, 10),
          season,
          coverImage: coverImage || null,
          itinerary,
          published,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Save failed')
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex items-center justify-between border-b border-zen-black/10 pb-4">
          <h2 className="font-headline font-black text-2xl italic text-zen-black">
            {mode === 'create' ? 'New Template' : 'Edit Template'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zen-black/40 hover:text-zen-black"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-800 text-xs">
            {error}
          </div>
        )}

        <Field label="Title">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
          />
        </Field>

        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="input"
          />
        </Field>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Total Days">
            <input
              required
              type="number"
              min="1"
              value={totalDays}
              onChange={(e) => setTotalDays(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Season">
            <select
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              className="input"
            >
              <option value="Winter">Winter</option>
              <option value="Spring">Spring</option>
              <option value="Summer">Summer</option>
              <option value="Autumn">Autumn</option>
            </select>
          </Field>
          <Field label="Published">
            <select
              value={published ? 'yes' : 'no'}
              onChange={(e) => setPublished(e.target.value === 'yes')}
              className="input"
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
        </div>

        <Field label="Cover Image">
          <CoverPicker value={coverImage} onChange={setCoverImage} />
        </Field>

        <Field label="Itinerary JSON">
          <textarea
            required
            value={itineraryJson}
            onChange={(e) => setItineraryJson(e.target.value)}
            rows={12}
            className="input font-mono text-xs"
            placeholder='{"title":"...","totalDays":7,"season":"Winter","days":[...]}'
          />
        </Field>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-3 border-2 border-zen-black font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black hover:text-white transition-all disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-3 bg-basel-brick text-white font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black transition-all disabled:opacity-40"
          >
            {saving ? 'Saving...' : mode === 'create' ? 'Create' : 'Save'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function PromoteModal({
  tripId,
  trips,
  onClose,
  onSaved,
}: {
  tripId: string
  trips: TripRow[]
  onClose: () => void
  onSaved: () => void
}) {
  const trip = trips.find((t) => t.id === tripId)
  const [description, setDescription] = useState('')
  const [coverImage, setCoverImage] = useState<string | null>(null)
  const [published, setPublished] = useState(true)
  const [consentConfirmed, setConsentConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!trip) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/templates/from-trip/${tripId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description || null,
          coverImage: coverImage || null,
          published,
        }),
      })
      if (!res.ok) throw new Error('Promote failed')
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Promote failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex items-center justify-between border-b border-zen-black/10 pb-4">
          <h2 className="font-headline font-black text-2xl italic text-zen-black">
            Promote to Template
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zen-black/40 hover:text-zen-black"
          >
            <X size={20} />
          </button>
        </div>

        <div className="bg-briefing-cream p-4 border-l-4 border-basel-brick">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-basel-brick mb-1">
            Source trip
          </p>
          <p className="font-bold text-zen-black">{trip.title}</p>
          <p className="text-xs text-zen-black/60 mt-1">
            by {trip.user.email} · {trip.source}
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-800 text-xs">
            {error}
          </div>
        )}

        <Field label="Description (optional)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="input"
            placeholder="Short pitch for the template gallery card..."
          />
        </Field>

        <Field label="Cover Image (optional)">
          <CoverPicker value={coverImage} onChange={setCoverImage} />
        </Field>

        <Field label="Publish immediately?">
          <select
            value={published ? 'yes' : 'no'}
            onChange={(e) => setPublished(e.target.value === 'yes')}
            className="input"
          >
            <option value="yes">Yes — live on /templates</option>
            <option value="no">No — save as draft</option>
          </select>
        </Field>

        {/* Consequences of promotion — user-lock warning */}
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-amber-700 flex-shrink-0 mt-0.5" />
            <div className="space-y-2 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-800">
                Before you promote
              </p>
              <ul className="text-xs text-amber-900 leading-relaxed space-y-1 list-disc pl-4">
                <li>
                  The original trip remains <strong>owned by the user</strong>, not transferred.
                </li>
                <li>
                  Once promoted, the user can <strong>no longer delete or edit</strong> this
                  trip. They will see a &quot;Published&quot; badge on their gallery card.
                </li>
                <li>
                  To remove the trip later, the user must contact admin via{' '}
                  <code className="font-mono bg-amber-200/50 px-1">/support</code>.
                </li>
                <li>
                  The same LINE share code (<code className="font-mono bg-amber-200/50 px-1">{trip.shareCode ?? 'auto-generated'}</code>) will be reused for the template.
                </li>
              </ul>
            </div>
          </div>

          <label className="flex items-start gap-2 cursor-pointer pt-2 border-t border-amber-300/50">
            <input
              type="checkbox"
              checked={consentConfirmed}
              onChange={(e) => setConsentConfirmed(e.target.checked)}
              className="mt-0.5 accent-basel-brick"
            />
            <span className="text-[11px] font-medium text-amber-900 leading-snug">
              I have contacted <strong>{trip.user.email}</strong> and they understand that
              this trip will be locked from editing and deletion once promoted.
            </span>
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-3 border-2 border-zen-black font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black hover:text-white transition-all disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !consentConfirmed}
            className="flex-1 py-3 bg-basel-brick text-white font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Promoting...' : 'Promote'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

interface CloudinaryAsset {
  public_id: string
  secure_url: string
  width: number
  height: number
  format: string
  created_at: string
  bytes: number
}

/**
 * Cover image picker — used in the promote modal and the template form modal.
 *
 * Three ways to set a cover:
 *   1. Pick a preset IMG key (stock1-4) — brand defaults
 *   2. Pick any previously-uploaded image from the dopamichi/covers Cloudinary
 *      folder (library browser, loaded from /api/admin/cloudinary/covers)
 *   3. Upload a new file via Cloudinary's hosted widget (4:5 forced crop)
 *
 * The stored value is either:
 *   - a short IMG key (e.g. "stock1") when a preset is picked
 *   - a full Cloudinary secure_url when a library asset or custom upload is chosen
 * Resolved to a final URL by lib/cover-image.ts at render time.
 */
function CoverPicker({
  value,
  onChange,
}: {
  value: string | null
  onChange: (value: string | null) => void
}) {
  // Cloudinary library state
  const [libraryAssets, setLibraryAssets] = useState<CloudinaryAsset[]>([])
  const [libraryLoading, setLibraryLoading] = useState(true)
  const [libraryError, setLibraryError] = useState<string | null>(null)

  async function loadLibrary() {
    setLibraryLoading(true)
    setLibraryError(null)
    try {
      const res = await fetch('/api/admin/cloudinary/covers')
      const data = await res.json()
      if (!res.ok) {
        setLibraryError(data.error ?? `HTTP ${res.status}`)
        return
      }
      setLibraryAssets(data.assets ?? [])
    } catch (err) {
      setLibraryError(err instanceof Error ? err.message : 'Failed to load library')
    } finally {
      setLibraryLoading(false)
    }
  }

  useEffect(() => {
    loadLibrary()
  }, [])

  // After a fresh upload Cloudinary's Admin API list takes ~1–2s to reflect
  // the new asset, so we also receive the URL from CoverUpload and prepend
  // it to the library optimistically.
  function handleUploaded(url: string) {
    setLibraryAssets((prev) => {
      if (prev.some((a) => a.secure_url === url)) return prev
      return [
        {
          public_id: url.split('/').slice(-2).join('/').replace(/\.[^.]+$/, ''),
          secure_url: url,
          width: 0,
          height: 0,
          format: '',
          created_at: new Date().toISOString(),
          bytes: 0,
        },
        ...prev,
      ]
    })
    // Also trigger a real refresh so we get the full metadata eventually
    setTimeout(loadLibrary, 2000)
  }

  async function handleDeleteAsset(asset: CloudinaryAsset, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`Delete this image from Cloudinary and remove it from any template/trip using it?\n\n${asset.public_id}`)) return
    try {
      const res = await fetch('/api/admin/cloudinary/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          public_id: asset.public_id,
          secure_url: asset.secure_url,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Delete failed')
      // Remove from local state
      setLibraryAssets((prev) => prev.filter((a) => a.public_id !== asset.public_id))
      // If the current value points at this asset, clear it
      if (value === asset.secure_url) onChange(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  return (
    <div className="space-y-4">
      {/* Cloudinary library — browse dopamichi/covers folder */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-zen-black/60">
            From Cloudinary library{libraryAssets.length > 0 ? ` (${libraryAssets.length})` : ''}
          </p>
          <button
            type="button"
            onClick={loadLibrary}
            disabled={libraryLoading}
            className="text-[9px] font-bold uppercase tracking-widest text-zen-black/40 hover:text-basel-brick disabled:opacity-40"
          >
            {libraryLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {libraryLoading ? (
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="aspect-square bg-zen-black/5 animate-pulse" />
            ))}
          </div>
        ) : libraryError ? (
          <div className="p-3 bg-red-50 border-l-4 border-red-600 flex items-start gap-2">
            <AlertCircle size={14} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-red-700">
                Cloudinary list failed
              </p>
              <p className="text-[10px] text-red-700 font-mono break-all">{libraryError}</p>
            </div>
          </div>
        ) : libraryAssets.length === 0 ? (
          <div className="p-4 bg-briefing-cream border border-zen-black/10 space-y-2">
            <p className="text-[10px] text-zen-black/60 italic leading-relaxed">
              No assets found under <code className="font-mono bg-zen-black/5 px-1">dopamichi/covers</code>.
            </p>
            <p className="text-[10px] text-zen-black/40 leading-relaxed">
              Upload your first cover below, or verify the upload preset has{' '}
              <code className="font-mono bg-zen-black/5 px-1">Folder = dopamichi/covers</code> set
              in the Cloudinary dashboard.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2 max-h-80 overflow-y-auto pr-1">
            {libraryAssets.map((asset) => {
              const isSelected = value === asset.secure_url
              return (
                <div
                  key={asset.public_id}
                  className={`relative aspect-square overflow-hidden border-2 transition-all group ${
                    isSelected
                      ? 'border-basel-brick scale-95'
                      : 'border-transparent hover:border-zen-black/30'
                  }`}
                  title={asset.public_id}
                >
                  <button
                    type="button"
                    onClick={() => onChange(asset.secure_url)}
                    className="absolute inset-0 w-full h-full"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset.secure_url}
                      alt={asset.public_id}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-basel-brick/30 flex items-center justify-center">
                        <div className="w-6 h-6 bg-basel-brick rounded-full flex items-center justify-center">
                          <Check size={14} className="text-white" strokeWidth={3} />
                        </div>
                      </div>
                    )}
                  </button>
                  {/* Delete button — hover reveal */}
                  <button
                    type="button"
                    onClick={(e) => handleDeleteAsset(asset, e)}
                    className="absolute top-1 right-1 z-10 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-700"
                    title={`Delete ${asset.public_id} from Cloudinary`}
                    aria-label="Delete asset"
                  >
                    <Trash2 size={11} strokeWidth={2.5} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* OR separator */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-zen-black/10" />
        <span className="text-[9px] font-black uppercase tracking-widest text-zen-black/40">
          or upload from device
        </span>
        <div className="flex-1 h-px bg-zen-black/10" />
      </div>

      {/* Branded upload — direct unsigned POST, cropping happens at
          render time via c_fill,g_auto,ar_4:5 transformations. */}
      <CoverUpload
        value={value}
        onChange={onChange}
        label="Upload from device"
        onUploaded={handleUploaded}
      />
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-black uppercase tracking-[0.3em] text-basel-brick mb-2">
        {label}
      </span>
      {children}
      <style jsx>{`
        :global(.input) {
          width: 100%;
          background: transparent;
          border: 1px solid rgba(35, 26, 14, 0.2);
          padding: 10px 12px;
          font-size: 14px;
          color: #231a0e;
          font-family: inherit;
        }
        :global(.input:focus) {
          outline: none;
          border-color: #b43325;
        }
      `}</style>
    </label>
  )
}

function ModalShell({
  children,
  onClose,
}: {
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center py-10 px-4 overflow-y-auto"
      style={{ backgroundColor: 'rgba(35,26,14,0.75)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-2xl bg-briefing-cream border border-zen-black/10 shadow-2xl p-8 my-auto">
        {children}
      </div>
    </div>
  )
}
