'use client'

import { useState } from 'react'
import { Plus, X, ChevronDown, Save, AlertCircle, Sparkles } from 'lucide-react'
import type { ItineraryV3, DayV3, ActivityV3, PlanOverview, Bilingual, PlanPriority } from '@/lib/itinerary-types'
import { PLAN_MEAL_SLOTS } from '@/lib/itinerary-types'

// Completion form for an AI-extracted plan: review what the VLM filled, complete
// the *mandatory* blanks (red ✱), optionally enrich the rest, then save as a Trip.
const SLOTS = [
  'Logistics', 'Living', 'Admin & Services',
  'Breakfast', 'Brunch', 'Lunch', 'AfternoonMeal', 'Dinner', 'LatenightMeal',
  'Activity 1', 'Activity 2', 'Activity 3', 'Activity 4', 'Activity 5', 'Activity 6', 'Activity 7', 'Activity 8',
]
const PRIORITIES: PlanPriority[] = ['Must', 'Recommend', 'Normal']
const MEALS = new Set<string>(PLAN_MEAL_SLOTS)
// Shared field shell — rounded-xl + the modal's border weight (was rounded-lg
// with a heavier hairline), so every input here matches the date/flight fields
// in the trip modal.
const inp = 'px-3 py-2 text-sm border border-zen-black/15 rounded-xl focus:outline-none focus:border-basel-brick bg-white w-full transition-colors'
const hasName = (n?: Bilingual | null) => !!(n && (n.en?.trim() || n.th?.trim()))

export default function DocToTripForm({ initial, saving, onSave }: {
  initial: ItineraryV3
  saving?: boolean
  onSave: (itin: ItineraryV3) => void
}) {
  const [itin, setItin] = useState<ItineraryV3>(initial)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showErrors, setShowErrors] = useState(false)

  const ov = itin.overview
  const patchOverview = (p: Partial<PlanOverview>) => setItin((s) => ({ ...s, overview: { ...s.overview, ...p } }))
  const patchDay = (di: number, p: Partial<DayV3>) => setItin((s) => ({ ...s, days: s.days.map((d, i) => (i === di ? { ...d, ...p } : d)) }))
  const patchAct = (di: number, ai: number, p: Partial<ActivityV3>) =>
    setItin((s) => ({ ...s, days: s.days.map((d, i) => (i === di ? { ...d, activities: d.activities.map((a, j) => (j === ai ? { ...a, ...p } : a)) } : d)) }))
  const addAct = (di: number) => {
    const idx = itin.days[di].activities.length
    setItin((s) => ({ ...s, days: s.days.map((d, i) => (i === di ? { ...d, activities: [...d.activities, { slot: 'Activity 1', name: { en: '', th: '' } }] } : d)) }))
    setExpanded((e) => new Set(e).add(`${di}-${idx}`))
  }
  const removeAct = (di: number, ai: number) =>
    setItin((s) => ({ ...s, days: s.days.map((d, i) => (i === di ? { ...d, activities: d.activities.filter((_, j) => j !== ai) } : d)) }))
  const addDay = () => setItin((s) => ({ ...s, days: [...s.days, { day: s.days.length + 1, name: { en: '', th: '' }, activities: [] }] }))
  const removeDay = (di: number) => setItin((s) => ({ ...s, days: s.days.filter((_, i) => i !== di).map((d, i) => ({ ...d, day: i + 1 })) }))
  const toggleRow = (k: string) => setExpanded((e) => { const n = new Set(e); n.has(k) ? n.delete(k) : n.add(k); return n })

  // ── validation: title + every activity needs a name ─────────────────────────
  const titleMissing = !ov.title?.trim()
  const namelessCount = itin.days.reduce((n, d) => n + d.activities.filter((a) => !hasName(a.name)).length, 0)
  const valid = !titleMissing && namelessCount === 0

  function submit() {
    setShowErrors(true)
    if (!valid) return
    onSave({ ...itin, title: ov.title!.trim(), totalDays: itin.days.length, overview: { ...ov, title: ov.title!.trim() } })
  }

  const errBorder = (bad: boolean) => (bad ? 'border-red-400 bg-red-50/40' : '')

  return (
    <div className="space-y-4 font-detail">
      <div className="flex items-start gap-2 rounded-2xl bg-briefing-cream px-3.5 py-3 text-[12px] leading-relaxed text-graphite/80">
        <Sparkles size={16} className="mt-px flex-shrink-0 text-basel-brick" strokeWidth={2.5} />
        <span>AI กรอกให้บางส่วนแล้ว — เติมช่องที่มี <span className="text-red-500 font-bold">✱</span> (จำเป็น) ให้ครบ ส่วนช่องอื่นเติมได้ตามต้องการ</span>
      </div>

      {/* Title (mandatory) */}
      <div>
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-basel-brick">ชื่อทริป · Title <span className="text-red-500">✱</span></label>
        <input value={ov.title ?? ''} onChange={(e) => patchOverview({ title: e.target.value })} placeholder="ตั้งชื่อทริป" className={`${inp} font-bold ${errBorder(showErrors && titleMissing)}`} />
      </div>

      {/* Days */}
      {itin.days.map((d, di) => (
        <div key={di} className="overflow-hidden rounded-2xl border border-zen-black/10 bg-white">
          <div className="flex items-center gap-3 px-4 py-3 bg-briefing-cream/60 border-b border-zen-black/10">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-basel-brick text-white font-black text-sm flex-shrink-0">{String(d.day).padStart(2, '0')}</span>
            <div className="flex-1 grid grid-cols-2 gap-2">
              <input value={d.name.en} onChange={(e) => patchDay(di, { name: { ...d.name, en: e.target.value } })} placeholder="ชื่อวัน (EN)" className={`${inp} py-1.5`} />
              <input value={d.name.th} onChange={(e) => patchDay(di, { name: { ...d.name, th: e.target.value } })} placeholder="ชื่อวัน (TH)" className={`${inp} py-1.5`} />
            </div>
            {itin.days.length > 1 && <button onClick={() => removeDay(di)} className="text-zen-black/40 hover:text-red-600 flex-shrink-0"><X size={16} /></button>}
          </div>
          <div className="p-4 space-y-2">
            {d.activities.length === 0 && <p className="py-1 text-xs text-graphite/50">ยังไม่มีกิจกรรม</p>}
            {d.activities.map((a, ai) => (
              <ActivityRow key={ai} a={a} di={di} ai={ai} open={expanded.has(`${di}-${ai}`)} showErrors={showErrors}
                onToggle={() => toggleRow(`${di}-${ai}`)} patch={patchAct} remove={removeAct} />
            ))}
            <button onClick={() => addAct(di)} className="flex w-full items-center justify-center gap-1.5 rounded-full border border-dashed border-zen-black/20 py-2 text-xs font-semibold text-graphite/70 transition-colors hover:border-basel-brick hover:text-basel-brick"><Plus size={13} /> เพิ่มกิจกรรม</button>
          </div>
        </div>
      ))}

      <button onClick={addDay} className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-dashed border-zen-black/20 py-2.5 text-sm font-semibold text-graphite/70 transition-colors hover:border-basel-brick hover:text-basel-brick"><Plus size={14} /> เพิ่มวัน</button>

      {showErrors && !valid && (
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-red-600"><AlertCircle size={15} />
          {titleMissing ? 'กรุณาตั้งชื่อทริป' : `กรุณากรอกชื่อกิจกรรมให้ครบ (เหลือ ${namelessCount} ช่อง)`}
        </p>
      )}

      <button onClick={submit} disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-zen-black py-3.5 text-sm font-semibold text-white shadow-md shadow-zen-black/25 transition-all hover:bg-basel-brick disabled:opacity-50">
        <Save size={15} strokeWidth={2.5} /> {saving ? 'กำลังบันทึก...' : 'ยืนยันและบันทึก · Confirm & save'}
      </button>
    </div>
  )
}

// ── Activity row (collapsible) ───────────────────────────────────────────────
function ActivityRow({ a, di, ai, open, showErrors, onToggle, patch, remove }: {
  a: ActivityV3; di: number; ai: number; open: boolean; showErrors: boolean; onToggle: () => void
  patch: (di: number, ai: number, p: Partial<ActivityV3>) => void
  remove: (di: number, ai: number) => void
}) {
  const name = a.name ?? { en: '', th: '' }
  const desc = a.description ?? { en: '', th: '' }
  const setName = (b: Bilingual) => patch(di, ai, { name: b })
  const setDesc = (b: Bilingual) => patch(di, ai, { description: b })
  const nameMissing = !(name.en?.trim() || name.th?.trim())
  const summary = name.th || name.en || ''

  return (
    <div className={`overflow-hidden rounded-xl border bg-briefing-cream/30 ${showErrors && nameMissing ? 'border-red-400' : 'border-zen-black/10'}`}>
      <div className="flex items-center gap-2 px-3 py-2">
        <button onClick={onToggle} className="flex-1 flex items-center gap-2 min-w-0 text-left">
          <ChevronDown size={15} className={`flex-shrink-0 text-zen-black/40 transition-transform ${open ? 'rotate-180' : ''}`} />
          <span className="text-[11px] font-bold text-basel-brick/80 w-11 flex-shrink-0">{a.time || '--:--'}</span>
          <span className="flex-shrink-0 rounded-full bg-zen-black/5 px-2 py-0.5 text-[10px] font-semibold text-graphite/70">{a.slot}</span>
          {summary
            ? <span className="text-sm font-bold text-zen-black truncate">{summary}</span>
            : <span className="text-sm font-bold text-red-500 truncate">ต้องใส่ชื่อ ✱</span>}
        </button>
        <button onClick={() => remove(di, ai)} className="text-zen-black/30 hover:text-red-600 flex-shrink-0"><X size={15} /></button>
      </div>

      {open && (
        <div className="px-3 pb-3 pt-1 space-y-2 border-t border-zen-black/10">
          <div className="flex items-center gap-2 flex-wrap">
            <select value={a.slot} onChange={(e) => patch(di, ai, { slot: e.target.value })} className={`${inp} py-1 w-auto`}>
              {SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input value={a.time ?? ''} onChange={(e) => patch(di, ai, { time: e.target.value || null })} placeholder="--:--" className={`${inp} py-1 w-[72px]`} />
            <input value={a.duration_min ?? ''} type="number" onChange={(e) => patch(di, ai, { duration_min: e.target.value ? parseInt(e.target.value, 10) || null : null })} placeholder="นาที" className={`${inp} py-1 w-[72px]`} />
            <select value={a.priority ?? ''} onChange={(e) => patch(di, ai, { priority: (e.target.value || null) as ActivityV3['priority'] })} className={`${inp} py-1 w-auto`}>
              <option value="">— priority —</option>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            {MEALS.has(a.slot) && (
              <label className="flex items-center gap-1 text-[11px] text-zen-black/60"><input type="checkbox" checked={!!a.is_default} onChange={(e) => patch(di, ai, { is_default: e.target.checked })} className="accent-amber-400" /> ⭐ แนะนำ</label>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={name.en} onChange={(e) => setName({ ...name, en: e.target.value })} placeholder="ชื่อ (EN)" className={`${inp} py-1.5 ${showErrors && nameMissing ? 'border-red-400' : ''}`} />
            <input value={name.th} onChange={(e) => setName({ ...name, th: e.target.value })} placeholder="ชื่อ (TH) ✱" className={`${inp} py-1.5 ${showErrors && nameMissing ? 'border-red-400' : ''}`} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <textarea value={desc.en} onChange={(e) => setDesc({ ...desc, en: e.target.value })} rows={2} placeholder="คำอธิบาย (EN)" className={`${inp} py-1.5 resize-y`} />
            <textarea value={desc.th} onChange={(e) => setDesc({ ...desc, th: e.target.value })} rows={2} placeholder="คำอธิบาย (TH)" className={`${inp} py-1.5 resize-y`} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={a.cost ?? ''} onChange={(e) => patch(di, ai, { cost: e.target.value || null })} placeholder="ราคา · Cost" className={`${inp} py-1.5`} />
            <input value={a.location ?? ''} onChange={(e) => patch(di, ai, { location: e.target.value || null })} placeholder="พื้นที่ · Location" className={`${inp} py-1.5`} />
          </div>
        </div>
      )}
    </div>
  )
}
