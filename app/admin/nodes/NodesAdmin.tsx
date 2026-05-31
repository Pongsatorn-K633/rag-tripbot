'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Edit2, Trash2, X, Search, MapPin, ExternalLink } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface Category {
  code: string
  root: string
  category: string
  subCategory: string
  emoji: string
  destination: string
}
interface NodeRow {
  id: string
  name: string
  nameTh: string | null
  categoryCode: string
  notes: string | null
  cost: string | null
  duration: string | null
  mapUrl: string | null
  city: string | null
  updatedAt: string
  category: { code: string; root: string; category: string; subCategory: string; emoji: string }
}

interface NodeForm {
  name: string
  nameTh: string
  categoryCode: string
  city: string
  cost: string
  duration: string
  notes: string
  mapUrl: string
}
const EMPTY_FORM: NodeForm = { name: '', nameTh: '', categoryCode: '', city: '', cost: '', duration: '', notes: '', mapUrl: '' }

// ── Component ─────────────────────────────────────────────────────────────────

export default function NodesAdmin() {
  const [categories, setCategories] = useState<Category[]>([])
  const [nodes, setNodes] = useState<NodeRow[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [q, setQ] = useState('')
  const [root, setRoot] = useState('')
  const [categoryCode, setCategoryCode] = useState('')

  // Editor modal: null = closed, {} = create, NodeRow = edit
  const [editing, setEditing] = useState<NodeRow | null | undefined>(undefined) // undefined = closed
  const [form, setForm] = useState<NodeForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const roots = useMemo(() => [...new Set(categories.map((c) => c.root))], [categories])

  // Load categories once
  useEffect(() => {
    fetch('/api/admin/categories')
      .then((r) => (r.ok ? r.json() : { categories: [] }))
      .then((d) => setCategories(d.categories ?? []))
      .catch(() => {})
  }, [])

  // Load nodes whenever filters change (debounced)
  const loadNodes = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (root) params.set('root', root)
      if (categoryCode) params.set('categoryCode', categoryCode)
      const res = await fetch(`/api/admin/nodes?${params.toString()}`)
      if (res.ok) setNodes((await res.json()).nodes ?? [])
    } finally {
      setLoading(false)
    }
  }, [q, root, categoryCode])

  useEffect(() => {
    const t = setTimeout(loadNodes, 250)
    return () => clearTimeout(t)
  }, [loadNodes])

  // ── Modal helpers ──
  function openCreate() {
    setForm({ ...EMPTY_FORM, categoryCode })
    setEditing(null)
    setError('')
  }
  function openEdit(n: NodeRow) {
    setForm({
      name: n.name, nameTh: n.nameTh ?? '', categoryCode: n.categoryCode, city: n.city ?? '',
      cost: n.cost ?? '', duration: n.duration ?? '', notes: n.notes ?? '', mapUrl: n.mapUrl ?? '',
    })
    setEditing(n)
    setError('')
  }
  function closeModal() {
    setEditing(undefined)
    setSaving(false)
  }

  async function save() {
    if (!form.name.trim() || !form.categoryCode) {
      setError('กรุณากรอกชื่อและเลือกหมวดหมู่ · Name + category required')
      return
    }
    setSaving(true)
    setError('')
    try {
      const isEdit = !!editing
      const res = await fetch(isEdit ? `/api/admin/nodes/${editing!.id}` : '/api/admin/nodes', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.error ?? 'Save failed')
      }
      closeModal()
      loadNodes()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
      setSaving(false)
    }
  }

  async function remove(n: NodeRow) {
    if (!confirm(`ลบโหนด "${n.name}" ออกจากคลัง? · Delete this node from the library?`)) return
    const res = await fetch(`/api/admin/nodes/${n.id}`, { method: 'DELETE' })
    if (res.ok) setNodes((prev) => prev.filter((x) => x.id !== n.id))
    else alert('Delete failed')
  }

  return (
    <main className="pt-[120px] pb-24 min-h-screen bg-briefing-cream px-6 md:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10 border-b border-zen-black/10 pb-8">
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-basel-brick">Admin · Library</p>
            <h1 className="text-5xl md:text-6xl font-black font-headline tracking-tighter text-zen-black italic">Node Library</h1>
            <p className="text-sm font-medium text-zen-black/60">คลังสถานที่ &amp; กิจกรรมสำหรับ mix-and-match · {nodes.length} nodes</p>
          </div>
          <Link href="/admin/dashboard" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zen-black/60 hover:text-basel-brick transition-colors self-start md:self-end">
            <ArrowLeft size={14} strokeWidth={3} /> Back to dashboard
          </Link>
        </div>

        {/* Filter bar */}
        <div className="bg-white border border-zen-black/10 shadow-sm p-4 mb-8 space-y-4 rounded-xl">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zen-black/30" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ค้นหาชื่อ / เมือง / โน้ต · Search name, city, notes"
                className="w-full pl-10 pr-3 py-2.5 text-sm border border-zen-black/20 rounded-lg focus:outline-none focus:border-basel-brick transition-colors"
              />
            </div>
            <select
              value={categoryCode}
              onChange={(e) => setCategoryCode(e.target.value)}
              className="px-3 py-2.5 text-sm border border-zen-black/20 rounded-lg focus:outline-none focus:border-basel-brick bg-white"
            >
              <option value="">ทุกหมวดย่อย · All sub-categories</option>
              {roots.map((r) => (
                <optgroup key={r} label={r}>
                  {categories.filter((c) => c.root === r).map((c) => (
                    <option key={c.code} value={c.code}>{c.emoji} {c.category} › {c.subCategory}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button onClick={openCreate} className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-basel-brick text-white font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black transition-all rounded-lg">
              <Plus size={15} strokeWidth={3} /> New node
            </button>
          </div>
          {/* Root chips */}
          <div className="flex flex-wrap gap-2">
            <Chip active={root === ''} onClick={() => { setRoot(''); setCategoryCode('') }}>ทั้งหมด</Chip>
            {roots.map((r) => (
              <Chip key={r} active={root === r} onClick={() => { setRoot(root === r ? '' : r); setCategoryCode('') }}>{r}</Chip>
            ))}
          </div>
        </div>

        {/* Nodes grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-28 bg-white border border-zen-black/10 rounded-xl animate-pulse" />)}
          </div>
        ) : nodes.length === 0 ? (
          <div className="border-2 border-dashed border-zen-black/10 rounded-xl p-16 text-center">
            <p className="text-zen-black/50 font-sans mb-1">ยังไม่มีโหนดในคลัง{q || root || categoryCode ? 'ที่ตรงกับตัวกรอง' : ''}</p>
            <p className="text-zen-black/30 text-sm">กด “New node” เพื่อเพิ่มสถานที่หรือกิจกรรมแรก</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {nodes.map((n) => (
              <div key={n.id} className="group bg-white border border-zen-black/10 rounded-xl p-4 hover:shadow-lg transition-all">
                <div className="flex items-start gap-2">
                  <span className="text-2xl leading-none flex-shrink-0" title={`${n.category.category} › ${n.category.subCategory}`}>{n.category.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-zen-black leading-tight truncate">{n.name}</p>
                    {n.nameTh && <p className="text-sm text-zen-black/60 truncate">{n.nameTh}</p>}
                    <p className="text-[10px] uppercase tracking-widest text-basel-brick/70 font-black mt-1 truncate">{n.category.subCategory}</p>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(n)} aria-label="Edit" className="p-1.5 text-zen-black/50 hover:text-basel-brick transition-colors"><Edit2 size={15} /></button>
                    <button onClick={() => remove(n)} aria-label="Delete" className="p-1.5 text-zen-black/50 hover:text-red-600 transition-colors"><Trash2 size={15} /></button>
                  </div>
                </div>
                {n.notes && <p className="text-xs text-zen-black/60 mt-2 line-clamp-2 leading-relaxed">{n.notes}</p>}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-zen-black/50">
                  {n.city && <span className="flex items-center gap-0.5"><MapPin size={11} /> {n.city}</span>}
                  {n.cost && <span className="font-bold text-basel-brick">{n.cost}</span>}
                  {n.duration && <span>{n.duration}</span>}
                  {n.mapUrl && (
                    <a href={n.mapUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-0.5 text-blue-600 hover:underline">
                      <ExternalLink size={11} /> Maps
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Editor modal */}
      {editing !== undefined && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-6 px-3" style={{ backgroundColor: 'rgba(35,26,14,0.7)' }} onClick={(e) => { if (e.target === e.currentTarget && !saving) closeModal() }}>
          <div className="w-full max-w-lg bg-briefing-cream border border-zen-black/10 shadow-2xl rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zen-black/10">
              <h2 className="font-headline font-black text-xl italic text-zen-black">{editing ? 'แก้ไขโหนด' : 'เพิ่มโหนดใหม่'}</h2>
              <button onClick={closeModal} className="text-zen-black/40 hover:text-zen-black text-2xl leading-none" aria-label="Close">&times;</button>
            </div>
            <div className="px-5 py-5 space-y-3.5 max-h-[70vh] overflow-y-auto">
              <Field label="ชื่อ (อังกฤษ) · Name *">
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="Susukino Ramen Village" />
              </Field>
              <Field label="ชื่อ (ไทย) · Thai name">
                <input value={form.nameTh} onChange={(e) => setForm({ ...form, nameTh: e.target.value })} className={inputCls} placeholder="ซูซูกิโนะ ราเมน วิลเลจ" />
              </Field>
              <Field label="หมวดหมู่ · Category *">
                <select value={form.categoryCode} onChange={(e) => setForm({ ...form, categoryCode: e.target.value })} className={inputCls}>
                  <option value="">— เลือกหมวดหมู่ —</option>
                  {roots.map((r) => (
                    <optgroup key={r} label={r}>
                      {categories.filter((c) => c.root === r).map((c) => (
                        <option key={c.code} value={c.code}>{c.emoji} {c.category} › {c.subCategory}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="เมือง · City"><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={inputCls} placeholder="Sapporo" /></Field>
                <Field label="ราคา · Cost"><input value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} className={inputCls} placeholder="¥1,000-1,500" /></Field>
              </div>
              <Field label="ระยะเวลา · Duration"><input value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} className={inputCls} placeholder="1h" /></Field>
              <Field label="โน้ต · Notes"><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={inputCls} placeholder="ราเมนซัปโปโรต้นตำรับ หลายร้านให้เลือก" /></Field>
              <Field label="ลิงก์ Google Maps · Map URL"><input value={form.mapUrl} onChange={(e) => setForm({ ...form, mapUrl: e.target.value })} className={inputCls} placeholder="https://maps.app.goo.gl/..." /></Field>
              {error && <p className="text-sm text-red-600 flex items-center gap-1.5"><X size={14} /> {error}</p>}
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-zen-black/10">
              <button onClick={closeModal} disabled={saving} className="flex-1 py-3 rounded-lg border-2 border-zen-black font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black hover:text-white transition-all disabled:opacity-40">ยกเลิก</button>
              <button onClick={save} disabled={saving} className="flex-1 py-3 rounded-lg bg-basel-brick text-white font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black transition-all disabled:opacity-40">{saving ? 'กำลังบันทึก...' : editing ? 'บันทึก' : 'เพิ่มโหนด'}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

const inputCls = 'w-full px-3 py-2.5 text-sm border border-zen-black/20 rounded-lg focus:outline-none focus:border-basel-brick transition-colors bg-white'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-basel-brick mb-1.5">{label}</span>
      {children}
    </label>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-[11px] font-bold rounded-full border transition-all ${active ? 'bg-basel-brick text-white border-basel-brick' : 'border-zen-black/20 text-zen-black/70 hover:border-basel-brick'}`}
    >
      {children}
    </button>
  )
}
