'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Plus, Edit2, Trash2, TrendingUp, Users, FileText, BookOpen, X, Eye, EyeOff, AlertCircle, Sparkles, Boxes } from 'lucide-react'
import CoverPicker from '@/app/components/CoverPicker'
import PlanPreviewModal from '@/app/components/PlanPreviewModal'
import type { PlanTemplate } from '@/app/components/PlanCard'
import { resolveCoverImage } from '@/lib/cover-image'
import type { TripAvailability } from '@/lib/itinerary-types'
import { formatRanges } from '@/lib/availability'

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
  coverImages?: string[] | null
  totalDays: number
  season: string | null
  availability: TripAvailability | null
  published: boolean
  createdAt: string
  createdBy: { id: string; email: string | null; name: string | null }
  _count: { savedAs: number }
  /** Canonical LINE activation code for this template — same for all admins */
  shareCode: string | null
  /** itinerary jsonb — only `version` is read here (v1 vs v2 badge). */
  itinerary?: { version?: number } | null
}

interface CurrentUser {
  id: string
  email: string
  role: string
}

type Tab = 'trips' | 'templates'

// ── Main component ───────────────────────────────────────────────────────────

export default function AdminDashboard({ currentUser }: { currentUser: CurrentUser }) {
  const [tab, setTab] = useState<Tab>('templates')
  const [trips, setTrips] = useState<TripRow[]>([])
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [nodesCount, setNodesCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [promoteTripId, setPromoteTripId] = useState<string | null>(null)
  const [viewId, setViewId] = useState<string | null>(null)

  async function loadAll() {
    setLoading(true)
    try {
      const [tripsRes, templatesRes, nodesRes] = await Promise.all([
        fetch('/api/admin/trips'),
        fetch('/api/admin/templates'),
        fetch('/api/admin/nodes'),
      ])
      if (tripsRes.ok) {
        const data = await tripsRes.json()
        setTrips(data.trips ?? [])
      }
      if (templatesRes.ok) {
        const data = await templatesRes.json()
        setTemplates(data.templates ?? [])
      }
      if (nodesRes.ok) {
        const data = await nodesRes.json()
        setNodesCount((data.nodes ?? []).length)
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-0 mb-12 border border-zen-black">
          <StatCard icon={FileText} label="Total Trips" value={stats.totalTrips} />
          <StatCard icon={Users} label="Unique Users" value={stats.uniqueUsers} />
          <StatCard icon={BookOpen} label="Pre-planned" value={stats.totalTemplates} />
          <StatCard icon={TrendingUp} label="Published" value={stats.publishedTemplates} />
          <StatCard icon={Boxes} label="Library Nodes" value={nodesCount} last />
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b-2 border-zen-black mb-10">
          <TabButton active={tab === 'trips'} onClick={() => setTab('trips')}>
            All Trips ({trips.length})
          </TabButton>
          <TabButton active={tab === 'templates'} onClick={() => setTab('templates')}>
            Pre-planned ({templates.length})
          </TabButton>
          <Link
            href="/admin/trip-builder"
            className="ml-auto px-6 py-4 text-[10px] font-black uppercase tracking-widest text-basel-brick hover:bg-basel-brick hover:text-white transition-all border-l border-zen-black"
          >
            Build Trip →
          </Link>
          <Link
            href="/admin/nodes"
            className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-basel-brick hover:bg-basel-brick hover:text-white transition-all border-l border-zen-black"
          >
            Node Library →
          </Link>
          {currentUser.role === 'SUPERADMIN' && (
            <Link
              href="/admin/users"
              className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-basel-brick hover:bg-basel-brick hover:text-white transition-all border-l border-zen-black"
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
            onView={(id) => setViewId(id)}
            onDelete={handleDeleteTemplate}
            onTogglePublished={handleTogglePublished}
            onCleanupCovers={handleCleanupCovers}
          />
        )}

        {/* Preview modal — same component travelers use on /pre-planned */}
        <PlanPreviewModal
          template={(templates.find((t) => t.id === viewId) ?? null) as unknown as PlanTemplate | null}
          callbackUrl="/admin/dashboard"
          viewOnly
          onClose={() => setViewId(null)}
        />

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
  onView,
  onDelete,
  onTogglePublished,
  onCleanupCovers,
}: {
  templates: TemplateRow[]
  onView: (id: string) => void
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
        <Link
          href="/admin/trip-builder"
          className="inline-flex items-center gap-2 px-5 py-3 bg-basel-brick text-white font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black transition-all"
        >
          <Plus size={14} strokeWidth={3} />
          Build New Trip
        </Link>
      </div>

      {templates.length === 0 ? (
        <div className="border-2 border-dashed border-zen-black/10 p-16 text-center">
          <p className="text-zen-black/40 font-sans text-lg mb-1">No pre-planned trips yet.</p>
          <p className="text-zen-black/30 text-sm">Use <span className="text-basel-brick font-bold">Build New Trip</span> to create one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {templates.map((tpl) => {
            const rec = tpl.availability?.recommended ?? []
            const avail = tpl.availability?.available ?? []
            return (
            <div key={tpl.id} onClick={() => onView(tpl.id)} title="ดูแพลน · Preview" className="group flex flex-col bg-white border border-zen-black/10 rounded-xl p-4 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer">
              {/* Cover — 4:5 portrait, matching the public PlanCard the traveler sees */}
              <div className="relative aspect-[4/5] overflow-hidden mb-4 rounded-lg bg-briefing-cream">
                <Image alt={tpl.title} src={resolveCoverImage(tpl.coverImage, tpl.id)} fill className="object-cover transition-all duration-700 group-hover:scale-105" sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw" />
                {/* DAYS badge over gradient — same treatment as PlanCard */}
                <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-zen-black/80 to-transparent">
                  <span className="bg-basel-brick text-briefing-cream px-3 py-1 text-[10px] font-black uppercase tracking-widest font-headline">{tpl.totalDays} DAYS</span>
                </div>
                {!tpl.published && (
                  <div className="absolute inset-0 bg-zen-black/60 flex items-center justify-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white bg-basel-brick px-3 py-1 rounded">Unpublished</span>
                  </div>
                )}
              </div>

              <h3 className="text-2xl font-headline font-bold text-zen-black leading-tight mb-1">{tpl.title}</h3>
              {tpl.description && <p className="text-sm text-zen-black/60 leading-relaxed mb-3 line-clamp-2">{tpl.description}</p>}

              {/* Travel periods — same layout as PlanCard */}
              <div className="mb-3 space-y-1">
                {rec.length > 0 && (
                  <p className="text-[11px] text-basel-brick font-bold">
                    <span className="uppercase tracking-widest text-[9px] text-basel-brick/60 mr-1">แนะนำ</span>{formatRanges(rec, 'th')}
                  </p>
                )}
                <p className="text-[11px] text-zen-black/50">
                  <span className="uppercase tracking-widest text-[9px] text-zen-black/40 mr-1">เปิดให้เที่ยว</span>{formatRanges(avail, 'th')}
                </p>
              </div>

              <div className="flex items-center gap-2 text-[10px] font-bold text-zen-black/40 uppercase tracking-widest mb-3">
                <span>{tpl.season ?? '—'}</span><span>·</span><span>{tpl._count.savedAs} saves</span>
              </div>

              {/* Template code — an identifier (view-only on LINE), NOT a personal
                  /activate code, so it's shown as plain text, not a copy button. */}
              {tpl.shareCode && (
                <p className="mb-3 text-[11px] text-zen-black/50" title="Template code (view-only on LINE) — not a chatbot activation code">
                  <span className="uppercase tracking-widest text-[9px] text-zen-black/40 mr-1">Code</span>
                  <span className="font-mono font-bold text-zen-black/70">{tpl.shareCode}</span>
                </p>
              )}

              <div className="mt-auto pt-3 border-t border-zen-black/10 flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                <span className="text-[9px] text-zen-black/40 truncate">{tpl.createdBy.email ?? 'system'}</span>
                <div className="flex gap-1">
                  <button onClick={() => onTogglePublished(tpl)} title={tpl.published ? 'Unpublish' : 'Publish'} className="p-1.5 text-zen-black/60 hover:text-basel-brick transition-colors">{tpl.published ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                  <Link href={`/admin/trip-builder/${tpl.id}`} title="Edit in builder" className="p-1.5 text-zen-black/60 hover:text-basel-brick transition-colors"><Edit2 size={14} /></Link>
                  <button onClick={() => onDelete(tpl.id)} title="Delete" className="p-1.5 text-zen-black/60 hover:text-red-600 transition-colors"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
            )
          })}
        </div>
      )}
    </div>
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
          <CoverPicker value={coverImage ? [coverImage] : []} onChange={(v) => setCoverImage(v[0] ?? null)} max={1} />
        </Field>

        <Field label="Publish immediately?">
          <select
            value={published ? 'yes' : 'no'}
            onChange={(e) => setPublished(e.target.value === 'yes')}
            className="input"
          >
            <option value="yes">Yes — live on /pre-planned</option>
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
      <div className="w-full max-w-2xl bg-briefing-cream border border-zen-black/10 shadow-2xl p-8 my-auto rounded-xl">
        {children}
      </div>
    </div>
  )
}
