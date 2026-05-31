'use client'

import { useState, useEffect, useMemo } from 'react'
import { Search, Plus } from 'lucide-react'
import type { NodeSnap } from '@/lib/itinerary-types'

interface Category { code: string; root: string; category: string; subCategory: string; emoji: string }
interface NodeRow {
  id: string; name: string; nameTh: string | null; categoryCode: string
  notes: string | null; cost: string | null; duration: string | null; mapUrl: string | null; city: string | null
  category: { emoji: string; subCategory: string }
}

/** Pick a node from the library, or type an ad-hoc one. Returns a frozen NodeSnap. */
export default function NodePicker({ onPick, onClose }: { onPick: (n: NodeSnap) => void; onClose: () => void }) {
  const [categories, setCategories] = useState<Category[]>([])
  const [q, setQ] = useState('')
  const [results, setResults] = useState<NodeRow[]>([])
  const [adhoc, setAdhoc] = useState(false)
  const [form, setForm] = useState({ name: '', nameTh: '', categoryCode: '', cost: '', duration: '', notes: '', mapUrl: '' })

  const roots = useMemo(() => [...new Set(categories.map((c) => c.root))], [categories])

  useEffect(() => {
    fetch('/api/admin/categories').then((r) => r.json()).then((d) => setCategories(d.categories ?? [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (adhoc) return
    const t = setTimeout(() => {
      const p = new URLSearchParams()
      if (q) p.set('q', q)
      fetch(`/api/admin/nodes?${p}`).then((r) => r.json()).then((d) => setResults(d.nodes ?? [])).catch(() => {})
    }, 250)
    return () => clearTimeout(t)
  }, [q, adhoc])

  function pickRow(n: NodeRow) {
    onPick({
      nodeId: n.id, name: n.name, nameTh: n.nameTh, categoryCode: n.categoryCode,
      emoji: n.category.emoji, notes: n.notes, cost: n.cost, duration: n.duration, mapUrl: n.mapUrl,
    })
  }
  function pickAdhoc() {
    if (!form.name.trim() || !form.categoryCode) return
    const cat = categories.find((c) => c.code === form.categoryCode)
    onPick({
      nodeId: null, name: form.name.trim(), nameTh: form.nameTh.trim() || null, categoryCode: form.categoryCode,
      emoji: cat?.emoji ?? null, notes: form.notes.trim() || null, cost: form.cost.trim() || null,
      duration: form.duration.trim() || null, mapUrl: form.mapUrl.trim() || null,
    })
  }

  const inp = 'w-full px-3 py-2 text-sm border border-zen-black/20 rounded-lg focus:outline-none focus:border-basel-brick'

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto py-6 px-3" style={{ backgroundColor: 'rgba(35,26,14,0.7)' }} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-md bg-briefing-cream border border-zen-black/10 shadow-2xl rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zen-black/10">
          <h3 className="font-headline font-black text-lg italic text-zen-black">{adhoc ? 'เพิ่มสถานที่ใหม่' : 'เลือกจากคลัง'}</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => setAdhoc(!adhoc)} className="text-[10px] font-black uppercase tracking-widest text-basel-brick hover:underline">{adhoc ? '← คลัง' : '+ Ad-hoc'}</button>
            <button onClick={onClose} className="text-zen-black/40 hover:text-zen-black text-xl leading-none">&times;</button>
          </div>
        </div>

        {!adhoc ? (
          <div className="p-4 space-y-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zen-black/30" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาในคลัง · Search library" className={`${inp} pl-9`} />
            </div>
            <div className="max-h-[50vh] overflow-y-auto space-y-1.5">
              {results.length === 0 ? (
                <p className="text-sm text-zen-black/40 text-center py-6">ไม่พบในคลัง — กด “+ Ad-hoc” เพื่อพิมพ์เอง</p>
              ) : results.map((n) => (
                <button key={n.id} onClick={() => pickRow(n)} className="w-full text-left flex items-center gap-2.5 px-3 py-2 bg-white border border-zen-black/10 rounded-lg hover:border-basel-brick transition-colors">
                  <span className="text-xl">{n.category.emoji}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold text-sm text-zen-black truncate">{n.name}{n.nameTh ? <span className="font-medium text-zen-black/50"> · {n.nameTh}</span> : null}</span>
                    <span className="block text-[10px] uppercase tracking-widest text-basel-brick/70 truncate">{n.category.subCategory}{n.city ? ` · ${n.city}` : ''}</span>
                  </span>
                  {n.cost && <span className="text-[11px] font-bold text-basel-brick flex-shrink-0">{n.cost}</span>}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-2.5">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ชื่อ (อังกฤษ) *" className={inp} autoFocus />
            <input value={form.nameTh} onChange={(e) => setForm({ ...form, nameTh: e.target.value })} placeholder="ชื่อ (ไทย)" className={inp} />
            <select value={form.categoryCode} onChange={(e) => setForm({ ...form, categoryCode: e.target.value })} className={inp}>
              <option value="">— หมวดหมู่ * —</option>
              {roots.map((r) => (
                <optgroup key={r} label={r}>
                  {categories.filter((c) => c.root === r).map((c) => <option key={c.code} value={c.code}>{c.emoji} {c.category} › {c.subCategory}</option>)}
                </optgroup>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder="ราคา" className={inp} />
              <input value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="ระยะเวลา" className={inp} />
            </div>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="โน้ต" className={inp} />
            <input value={form.mapUrl} onChange={(e) => setForm({ ...form, mapUrl: e.target.value })} placeholder="Google Maps URL" className={inp} />
            <button onClick={pickAdhoc} disabled={!form.name.trim() || !form.categoryCode} className="w-full py-2.5 rounded-lg bg-basel-brick text-white font-headline font-black text-xs uppercase tracking-widest hover:bg-zen-black transition-all disabled:opacity-40 flex items-center justify-center gap-1.5">
              <Plus size={14} /> ใช้สถานที่นี้
            </button>
            <p className="text-[11px] text-zen-black/40 text-center">หมายเหตุ: สถานที่ ad-hoc จะถูกบันทึกเฉพาะในทริปนี้ (ไม่เข้าคลัง)</p>
          </div>
        )}
      </div>
    </div>
  )
}
