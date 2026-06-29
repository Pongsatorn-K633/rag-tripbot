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
const inp = 'px-3 py-2 text-sm border rounded-lg focus:outline-none focus:border-basel-brick bg-white w-full transition-colors'
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

  const errBorder = (bad: boolean) => (bad ? 'border-red-400 bg-red-50/40' : 'border-zen-black/20')

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-[13px] leading-relaxed bg-blue-50 text-blue-900 border border-blue-200 rounded-lg px-3.5 py-3">
        <Sparkles size={16} className="text-blue-500 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
        <span>AI กรอกให้บางส่วนแล้ว — เติมช่องที่มี <span className="text-red-500 font-bold">✱</span> (จำเป็น) ให้ครบ ส่วนช่องอื่นเติมได้ตามต้องการ</span>
      </div>

      {/* Title (mandatory) */}
      <div>
        <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-basel-brick mb-1.5">ชื่อทริป · Title <span className="text-red-500">✱</span></label>
        <input value={ov.title ?? ''} onChange={(e) => patchOverview({ title: e.target.value })} placeholder="ตั้งชื่อทริป" className={`${inp} font-bold ${errBorder(showErrors && titleMissing)}`} />
      </div>

      {/* Days */}
      {itin.days.map((d, di) => (
        <div key={di} className="border border-zen-black/10 rounded-xl overflow-hidden bg-white">
          <div className="flex items-center gap-3 px-4 py-3 bg-briefing-cream/60 border-b border-zen-black/10">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-basel-brick text-white font-black text-sm flex-shrink-0">{String(d.day).padStart(2, '0')}</span>
            <div className="flex-1 grid grid-cols-2 gap-2">
              <input value={d.name.en} onChange={(e) => patchDay(di, { name: { ...d.name, en: e.target.value } })} placeholder="ชื่อวัน (EN)" className={`${inp} py-1.5 border-zen-black/20`} />
              <input value={d.name.th} onChange={(e) => patchDay(di, { name: { ...d.name, th: e.target.value } })} placeholder="ชื่อวัน (TH)" className={`${inp} py-1.5 border-zen-black/20`} />
            </div>
            {itin.days.length > 1 && <button onClick={() => removeDay(di)} className="text-zen-black/40 hover:text-red-600 flex-shrink-0"><X size={16} /></button>}
          </div>
          <div className="p-4 space-y-2">
            {d.activities.length === 0 && <p className="text-xs text-zen-black/30 py-1">ยังไม่มีกิจกรรม</p>}
            {d.activities.map((a, ai) => (
              <ActivityRow key={ai} a={a} di={di} ai={ai} open={expanded.has(`${di}-${ai}`)} showErrors={showErrors}
                onToggle={() => toggleRow(`${di}-${ai}`)} patch={patchAct} remove={removeAct} />
            ))}
            <button onClick={() => addAct(di)} className="w-full py-2 border border-dashed border-zen-black/20 rounded-lg text-zen-black/50 text-xs font-bold hover:border-basel-brick hover:text-basel-brick transition-all flex items-center justify-center gap-1.5"><Plus size={13} /> เพิ่มกิจกรรม</button>
          </div>
        </div>
      ))}

      <button onClick={addDay} className="w-full py-2.5 border-2 border-dashed border-zen-black/20 rounded-xl text-zen-black/50 font-headline font-black text-xs uppercase tracking-widest hover:border-basel-brick hover:text-basel-brick transition-all flex items-center justify-center gap-2"><Plus size={14} /> เพิ่มวัน</button>

      {showErrors && !valid && (
        <p className="text-sm text-red-600 flex items-center gap-1.5"><AlertCircle size={15} />
          {titleMissing ? 'กรุณาตั้งชื่อทริป' : `กรุณากรอกชื่อกิจกรรมให้ครบ (เหลือ ${namelessCount} ช่อง)`}
        </p>
      )}

      <button onClick={submit} disabled={saving}
        className="w-full py-4 bg-basel-brick text-white font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black transition-all disabled:opacity-50 flex items-center justify-center gap-2">
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
    <div className={`border rounded-lg bg-briefing-cream/30 overflow-hidden ${showErrors && nameMissing ? 'border-red-400' : 'border-zen-black/10'}`}>
      <div className="flex items-center gap-2 px-3 py-2">
        <button onClick={onToggle} className="flex-1 flex items-center gap-2 min-w-0 text-left">
          <ChevronDown size={15} className={`flex-shrink-0 text-zen-black/40 transition-transform ${open ? 'rotate-180' : ''}`} />
          <span className="text-[11px] font-bold text-basel-brick/80 w-11 flex-shrink-0">{a.time || '--:--'}</span>
          <span className="text-[10px] font-bold text-zen-black/40 px-1.5 py-0.5 rounded bg-zen-black/5 flex-shrink-0">{a.slot}</span>
          {summary
            ? <span className="text-sm font-bold text-zen-black truncate">{summary}</span>
            : <span className="text-sm font-bold text-red-500 truncate">ต้องใส่ชื่อ ✱</span>}
        </button>
        <button onClick={() => remove(di, ai)} className="text-zen-black/30 hover:text-red-600 flex-shrink-0"><X size={15} /></button>
      </div>

      {open && (
        <div className="px-3 pb-3 pt-1 space-y-2 border-t border-zen-black/10">
          <div className="flex items-center gap-2 flex-wrap">
            <select value={a.slot} onChange={(e) => patch(di, ai, { slot: e.target.value })} className={`${inp} py-1 w-auto border-zen-black/20`}>
              {SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input value={a.time ?? ''} onChange={(e) => patch(di, ai, { time: e.target.value || null })} placeholder="--:--" className={`${inp} py-1 w-[72px] border-zen-black/20`} />
            <input value={a.duration_min ?? ''} type="number" onChange={(e) => patch(di, ai, { duration_min: e.target.value ? parseInt(e.target.value, 10) || null : null })} placeholder="นาที" className={`${inp} py-1 w-[72px] border-zen-black/20`} />
            <select value={a.priority ?? ''} onChange={(e) => patch(di, ai, { priority: (e.target.value || null) as ActivityV3['priority'] })} className={`${inp} py-1 w-auto border-zen-black/20`}>
              <option value="">— priority —</option>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            {MEALS.has(a.slot) && (
              <label className="flex items-center gap-1 text-[11px] text-zen-black/60"><input type="checkbox" checked={!!a.is_default} onChange={(e) => patch(di, ai, { is_default: e.target.checked })} className="accent-amber-400" /> ⭐ แนะนำ</label>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={name.en} onChange={(e) => setName({ ...name, en: e.target.value })} placeholder="ชื่อ (EN)" className={`${inp} py-1.5 ${showErrors && nameMissing ? 'border-red-400' : 'border-zen-black/20'}`} />
            <input value={name.th} onChange={(e) => setName({ ...name, th: e.target.value })} placeholder="ชื่อ (TH) ✱" className={`${inp} py-1.5 ${showErrors && nameMissing ? 'border-red-400' : 'border-zen-black/20'}`} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <textarea value={desc.en} onChange={(e) => setDesc({ ...desc, en: e.target.value })} rows={2} placeholder="คำอธิบาย (EN)" className={`${inp} py-1.5 resize-y border-zen-black/20`} />
            <textarea value={desc.th} onChange={(e) => setDesc({ ...desc, th: e.target.value })} rows={2} placeholder="คำอธิบาย (TH)" className={`${inp} py-1.5 resize-y border-zen-black/20`} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={a.cost ?? ''} onChange={(e) => patch(di, ai, { cost: e.target.value || null })} placeholder="ราคา · Cost" className={`${inp} py-1.5 border-zen-black/20`} />
            <input value={a.location ?? ''} onChange={(e) => patch(di, ai, { location: e.target.value || null })} placeholder="พื้นที่ · Location" className={`${inp} py-1.5 border-zen-black/20`} />
          </div>
        </div>
      )}
    </div>
  )
}
