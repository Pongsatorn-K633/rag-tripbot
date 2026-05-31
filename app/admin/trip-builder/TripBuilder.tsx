'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Save, X, Clock } from 'lucide-react'
import type { DayV2, Slot, NodeSnap, ItineraryV2, ActivityPriority } from '@/lib/itinerary-types'
import NodePicker from './NodePicker'

const MEALS: { key: 'breakfast' | 'lunch' | 'dinner'; label: string }[] = [
  { key: 'breakfast', label: '🍳 เช้า' },
  { key: 'lunch', label: '🍱 กลางวัน' },
  { key: 'dinner', label: '🍽️ เย็น' },
]

function newDay(day: number): DayV2 {
  return { day, location: '', meals: { breakfast: null, lunch: null, dinner: null }, activities: [], accommodation: null, transport: [] }
}
const single = (node: NodeSnap): Slot => ({ kind: 'single', node })

/** Admin v2 trip builder — mix-and-match library nodes into day slots, save as a template. */
export default function TripBuilder() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [season, setSeason] = useState('')
  const [description, setDescription] = useState('')
  const [days, setDays] = useState<DayV2[]>([newDay(1)])
  const [picker, setPicker] = useState<{ onPick: (n: NodeSnap) => void } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function updateDay(i: number, fn: (d: DayV2) => DayV2) {
    setDays((prev) => prev.map((d, idx) => (idx === i ? fn(d) : d)))
  }
  function addDay() { setDays((p) => [...p, newDay(p.length + 1)]) }
  function removeDay(i: number) { setDays((p) => p.filter((_, idx) => idx !== i).map((d, idx) => ({ ...d, day: idx + 1 }))) }
  function pick(onPick: (n: NodeSnap) => void) {
    setPicker({ onPick: (n) => { onPick(n); setPicker(null) } })
  }

  async function save() {
    if (!title.trim()) { setError('กรุณาตั้งชื่อทริป'); return }
    if (days.some((d) => !d.location.trim())) { setError('กรุณากรอกเมืองให้ครบทุกวัน'); return }
    setSaving(true); setError('')
    const itinerary: ItineraryV2 = { version: 2, title: title.trim(), totalDays: days.length, season: season || undefined, description: description || undefined, days }
    try {
      const res = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), itinerary, totalDays: days.length, season: season || undefined, description: description || undefined, published: false }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed')
      router.push('/admin/dashboard')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed'); setSaving(false)
    }
  }

  const inp = 'px-3 py-2 text-sm border border-zen-black/20 rounded-lg focus:outline-none focus:border-basel-brick bg-white'

  return (
    <main className="pt-[120px] pb-24 min-h-screen bg-briefing-cream px-6 md:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-8 border-b border-zen-black/10 pb-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-basel-brick">Admin · Builder</p>
            <h1 className="text-4xl md:text-5xl font-black font-headline tracking-tighter text-zen-black italic">Trip Builder</h1>
            <p className="text-sm text-zen-black/50 mt-1">สร้างแพลนแบบ node/slot (v2)</p>
          </div>
          <Link href="/admin/dashboard" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zen-black/60 hover:text-basel-brick"><ArrowLeft size={14} strokeWidth={3} /> Dashboard</Link>
        </div>

        {/* Meta */}
        <div className="bg-white border border-zen-black/10 rounded-xl p-4 mb-6 space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ชื่อทริป · Trip title *" className={`${inp} w-full font-bold`} />
          <div className="grid grid-cols-2 gap-3">
            <select value={season} onChange={(e) => setSeason(e.target.value)} className={inp}>
              <option value="">ฤดู · Season</option>
              {['Winter', 'Spring', 'Summer', 'Autumn'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="flex items-center text-sm text-zen-black/50 px-1">{days.length} วัน</div>
          </div>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="คำอธิบายสั้น ๆ · Description" className={`${inp} w-full`} />
        </div>

        {/* Days */}
        <div className="space-y-5">
          {days.map((d, i) => (
            <div key={i} className="bg-white border border-zen-black/10 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 bg-briefing-cream/60 border-b border-zen-black/10">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-basel-brick text-white font-black text-sm">{String(d.day).padStart(2, '0')}</span>
                <input value={d.location} onChange={(e) => updateDay(i, (x) => ({ ...x, location: e.target.value }))} placeholder="เมือง / พื้นที่ · Location *" className={`${inp} flex-1`} />
                <label className="flex items-center gap-1.5 text-[11px] text-zen-black/60"><input type="checkbox" checked={!!d.free} onChange={(e) => updateDay(i, (x) => ({ ...x, free: e.target.checked }))} className="accent-basel-brick" /> วันอิสระ</label>
                {days.length > 1 && <button onClick={() => removeDay(i)} className="text-zen-black/40 hover:text-red-600"><Trash2 size={16} /></button>}
              </div>

              <div className="p-4 space-y-4">
                {/* Meals */}
                <Section title="มื้ออาหาร · Meals">
                  {MEALS.map((m) => (
                    <SlotRow key={m.key} label={m.label}
                      slot={d.meals[m.key]}
                      onSet={() => pick((n) => updateDay(i, (x) => ({ ...x, meals: { ...x.meals, [m.key]: single(n) } })))}
                      onClear={() => updateDay(i, (x) => ({ ...x, meals: { ...x.meals, [m.key]: null } }))}
                    />
                  ))}
                </Section>

                {/* Activities */}
                <Section title="กิจกรรม · Activities" onAdd={() => pick((n) => updateDay(i, (x) => ({ ...x, activities: [...x.activities, { time: null, priority: 'optional', node: n }] })))}>
                  {d.activities.length === 0 && <p className="text-xs text-zen-black/30">ยังไม่มีกิจกรรม</p>}
                  {d.activities.map((a, ai) => (
                    <div key={ai} className="flex items-center gap-2 text-sm">
                      <span className="relative w-[72px] flex-shrink-0">
                        <Clock size={11} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-zen-black/30" />
                        <input value={a.time ?? ''} onChange={(e) => updateDay(i, (x) => ({ ...x, activities: x.activities.map((y, k) => k === ai ? { ...y, time: e.target.value || null } : y) }))} placeholder="--:--" className={`${inp} w-full pl-6 py-1`} />
                      </span>
                      <select value={a.priority ?? 'optional'} onChange={(e) => updateDay(i, (x) => ({ ...x, activities: x.activities.map((y, k) => k === ai ? { ...y, priority: e.target.value as ActivityPriority } : y) }))} className={`${inp} py-1`}>
                        <option value="mandatory">ต้อง</option><option value="recommended">แนะนำ</option><option value="optional">เสริม</option>
                      </select>
                      <span className="flex-1 flex items-center gap-1.5 min-w-0"><span>{a.node.emoji}</span><span className="truncate font-medium">{a.node.name}</span></span>
                      <button onClick={() => updateDay(i, (x) => ({ ...x, activities: x.activities.filter((_, k) => k !== ai) }))} className="text-zen-black/30 hover:text-red-600"><X size={14} /></button>
                    </div>
                  ))}
                </Section>

                {/* Accommodation */}
                <Section title="ที่พัก · Accommodation">
                  <SlotRow label="🏨 พัก" slot={d.accommodation}
                    onSet={() => pick((n) => updateDay(i, (x) => ({ ...x, accommodation: single(n) })))}
                    onClear={() => updateDay(i, (x) => ({ ...x, accommodation: null }))}
                  />
                </Section>

                {/* Transport */}
                <Section title="การเดินทาง · Transport" onAdd={() => updateDay(i, (x) => ({ ...x, transport: [...x.transport, { from: '', to: '', notes: '' }] }))}>
                  {d.transport.length === 0 && <p className="text-xs text-zen-black/30">ยังไม่มี</p>}
                  {d.transport.map((leg, li) => (
                    <div key={li} className="flex items-center gap-1.5 text-sm">
                      <input value={leg.from ?? ''} onChange={(e) => updateDay(i, (x) => ({ ...x, transport: x.transport.map((y, k) => k === li ? { ...y, from: e.target.value } : y) }))} placeholder="จาก" className={`${inp} w-24 py-1`} />
                      <span className="text-zen-black/30">→</span>
                      <input value={leg.to ?? ''} onChange={(e) => updateDay(i, (x) => ({ ...x, transport: x.transport.map((y, k) => k === li ? { ...y, to: e.target.value } : y) }))} placeholder="ถึง" className={`${inp} w-24 py-1`} />
                      <input value={leg.notes ?? ''} onChange={(e) => updateDay(i, (x) => ({ ...x, transport: x.transport.map((y, k) => k === li ? { ...y, notes: e.target.value } : y) }))} placeholder="วิธี / โน้ต" className={`${inp} flex-1 py-1`} />
                      <button onClick={() => updateDay(i, (x) => ({ ...x, transport: x.transport.filter((_, k) => k !== li) }))} className="text-zen-black/30 hover:text-red-600"><X size={14} /></button>
                    </div>
                  ))}
                </Section>
              </div>
            </div>
          ))}
        </div>

        <button onClick={addDay} className="mt-5 w-full py-3 border-2 border-dashed border-zen-black/20 rounded-xl text-zen-black/50 font-headline font-black text-xs uppercase tracking-widest hover:border-basel-brick hover:text-basel-brick transition-all flex items-center justify-center gap-2"><Plus size={15} /> เพิ่มวัน</button>

        {error && <p className="mt-4 text-sm text-red-600 flex items-center gap-1.5"><X size={14} /> {error}</p>}

        <button onClick={save} disabled={saving} className="mt-6 w-full py-4 rounded-xl bg-basel-brick text-white font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black transition-all disabled:opacity-40 flex items-center justify-center gap-2">
          <Save size={15} /> {saving ? 'กำลังบันทึก...' : 'บันทึกเป็นเทมเพลต (ร่าง)'}
        </button>
        <p className="mt-2 text-[11px] text-zen-black/40 text-center">บันทึกเป็นแบบร่าง (ยังไม่เผยแพร่) — เปิดเผยแพร่ได้ที่ Dashboard</p>
      </div>

      {picker && <NodePicker onPick={picker.onPick} onClose={() => setPicker(null)} />}
    </main>
  )
}

function Section({ title, onAdd, children }: { title: string; onAdd?: () => void; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-basel-brick">{title}</p>
        {onAdd && <button onClick={onAdd} className="text-[10px] font-black text-basel-brick hover:underline flex items-center gap-0.5"><Plus size={12} /> เพิ่ม</button>}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function SlotRow({ label, slot, onSet, onClear }: { label: string; slot: Slot | null; onSet: () => void; onClear: () => void }) {
  const node = slot?.kind === 'single' ? slot.node : null
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-20 text-[11px] font-bold text-zen-black/50 flex-shrink-0">{label}</span>
      {node ? (
        <span className="flex-1 flex items-center gap-1.5 min-w-0 bg-briefing-cream/60 rounded px-2 py-1">
          <span>{node.emoji}</span><span className="truncate font-medium text-zen-black">{node.name}</span>
          {node.cost && <span className="text-[11px] text-basel-brick font-bold ml-auto">{node.cost}</span>}
          <button onClick={onClear} className="text-zen-black/30 hover:text-red-600 flex-shrink-0"><X size={14} /></button>
        </span>
      ) : (
        <button onClick={onSet} className="flex-1 text-left text-zen-black/40 border border-dashed border-zen-black/20 rounded px-2 py-1 hover:border-basel-brick transition-colors">+ เลือกโหนด</button>
      )}
    </div>
  )
}
