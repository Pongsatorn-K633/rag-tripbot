'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Trash2, Clock, CalendarDays, Check, Star, Save } from 'lucide-react'
import type { ItineraryV3, ActivityV3 } from '@/lib/itinerary-types'
import { PLAN_MEAL_SLOTS } from '@/lib/itinerary-types'

/**
 * Light per-day editor for a V3 trip (the user's customizable copy). Supports:
 * set start date · pick one option per meal choice · reorder / remove timeline items.
 * Meal slots that repeat become a pick-one choice; everything else is a single row.
 */
const MEALS = new Set<string>(PLAN_MEAL_SLOTS)
const MEAL_LABEL: Record<string, string> = {
  Breakfast: '🍳 มื้อเช้า', Brunch: '🥐 มื้อสาย', Lunch: '🍱 มื้อกลางวัน',
  AfternoonMeal: '🍵 มื้อบ่าย', Dinner: '🍽️ มื้อเย็น', LatenightMeal: '🌙 มื้อดึก',
}

type Item = { kind: 'single' | 'choice'; acts: ActivityV3[] }
/** Group adjacent repeated meal slots into a choice; everything else is one row. */
function toItems(acts: ActivityV3[]): Item[] {
  const items: Item[] = []
  let i = 0
  while (i < acts.length) {
    const slot = acts[i].slot
    if (MEALS.has(slot)) {
      let j = i + 1
      while (j < acts.length && acts[j].slot === slot) j++
      if (j - i > 1) { items.push({ kind: 'choice', acts: acts.slice(i, j) }); i = j; continue }
    }
    items.push({ kind: 'single', acts: [acts[i]] }); i++
  }
  return items
}
const flat = (items: Item[]) => items.flatMap((it) => it.acts)
const nameOf = (a: ActivityV3) => a.name?.th || a.name?.en || '—'

const V = {
  light: { card: 'bg-white border-zen-black/10', text: 'text-zen-black', sub: 'text-zen-black/50', input: 'bg-briefing-cream border-zen-black/20 text-zen-black', icon: 'text-zen-black/40 hover:text-basel-brick', del: 'text-zen-black/40 hover:text-red-600', divider: 'border-zen-black/10', daySummary: 'hover:bg-briefing-cream/60', opt: 'border-zen-black/15' },
  dark: { card: 'bg-[#0A0A0A] border-white/10', text: 'text-briefing-cream', sub: 'text-briefing-cream/50', input: 'bg-white/5 border-white/15 text-briefing-cream', icon: 'text-briefing-cream/40 hover:text-basel-brick', del: 'text-briefing-cream/40 hover:text-red-400', divider: 'border-white/10', daySummary: 'hover:bg-white/5', opt: 'border-white/15' },
} as const

export default function ItineraryEditorV3({
  initialItinerary, initialStartDate = '', variant = 'light', saving = false, onSave,
}: {
  initialItinerary: ItineraryV3
  initialStartDate?: string
  variant?: 'light' | 'dark'
  saving?: boolean
  onSave: (data: { itinerary: ItineraryV3; startDate: string }) => void
}) {
  const t = V[variant]
  const [itin, setItin] = useState<ItineraryV3>(initialItinerary)
  const [startDate, setStartDate] = useState(initialStartDate)
  const [openDay, setOpenDay] = useState<number | null>(itin.days[0]?.day ?? null)

  const setDayItems = (di: number, items: Item[]) =>
    setItin((p) => ({ ...p, days: p.days.map((d, i) => (i === di ? { ...d, activities: flat(items) } : d)) }))

  return (
    <div className="space-y-5">
      {/* Start date */}
      <div className={`border p-4 ${t.card}`}>
        <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-basel-brick mb-2"><CalendarDays size={13} strokeWidth={2.5} /> วันเริ่มเดินทาง · Start date</label>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`w-full border px-3 py-2.5 text-sm font-medium focus:outline-none focus:border-basel-brick transition-colors ${t.input}`} />
      </div>

      {itin.days.map((day, di) => {
        const isOpen = openDay === day.day
        const items = toItems(day.activities)
        const move = (idx: number, dir: -1 | 1) => {
          const j = idx + dir
          if (j < 0 || j >= items.length) return
          const next = [...items]
          ;[next[idx], next[j]] = [next[j], next[idx]]
          setDayItems(di, next)
        }
        const remove = (idx: number) => setDayItems(di, items.filter((_, i) => i !== idx))
        const pick = (idx: number, optIdx: number) =>
          setDayItems(di, items.map((it, i) => (i !== idx ? it : { ...it, acts: it.acts.map((a, k) => ({ ...a, selected: k === optIdx ? true : null })) })))

        return (
          <div key={day.day} className={`border overflow-hidden ${t.card}`}>
            <button type="button" onClick={() => setOpenDay(isOpen ? null : day.day)} className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${t.daySummary}`}>
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-basel-brick text-white font-black text-sm flex-shrink-0">{String(day.day).padStart(2, '0')}</span>
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-base leading-tight truncate ${t.text}`}>{day.name.th || day.name.en || `Day ${day.day}`}</p>
                <p className={`text-[11px] ${t.sub}`}>{items.length} รายการ</p>
              </div>
              <ChevronDown size={18} className={`flex-shrink-0 transition-transform ${t.icon} ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
              <div className={`border-t px-4 py-4 space-y-3 ${t.divider}`}>
                {items.map((it, idx) => it.kind === 'choice' ? (
                  <div key={idx} className="border border-blue-300/50 rounded-lg">
                    <div className="px-3 py-2 flex items-center gap-2 border-b border-blue-300/30">
                      <Star size={11} className="text-blue-500" strokeWidth={2.5} />
                      <p className={`text-[10px] font-bold uppercase tracking-widest flex-1 ${t.sub}`}>{MEAL_LABEL[it.acts[0].slot] ?? it.acts[0].slot}</p>
                      <span className="text-[8px] font-black uppercase tracking-widest text-blue-500">เลือก 1</span>
                    </div>
                    <div className="p-2 space-y-2">
                      {it.acts.map((a, optIdx) => {
                        const picked = !!a.selected
                        return (
                          <button key={optIdx} type="button" onClick={() => pick(idx, optIdx)} className={`w-full text-left border px-3 py-2 rounded transition-all flex items-center gap-2 ${picked ? 'border-basel-brick bg-basel-brick/10' : `${t.opt} hover:border-basel-brick`}`}>
                            <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 border ${picked ? 'bg-basel-brick border-basel-brick' : 'border-current opacity-40'}`}>{picked && <Check size={11} className="text-white" strokeWidth={3} />}</span>
                            <span className={`flex-1 min-w-0 font-bold text-sm ${t.text}`}>{nameOf(a)}{a.is_default && <span className="ml-1.5 text-[9px] text-amber-500">⭐</span>}</span>
                            {a.cost && <span className="text-[10px] font-bold text-basel-brick flex-shrink-0">{a.cost}</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div key={idx} className={`border rounded p-3 ${t.opt}`}>
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        {it.acts[0].time && <span className="text-[10px] font-bold text-basel-brick uppercase tracking-widest flex items-center gap-1"><Clock size={10} strokeWidth={2.5} /> {it.acts[0].time}</span>}
                        <p className={`font-bold text-sm mt-0.5 ${t.text}`}>{nameOf(it.acts[0])}</p>
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0} className={`p-1.5 disabled:opacity-20 ${t.icon}`}><ChevronUp size={15} strokeWidth={2.5} /></button>
                        <button type="button" onClick={() => move(idx, 1)} disabled={idx === items.length - 1} className={`p-1.5 disabled:opacity-20 ${t.icon}`}><ChevronDown size={15} strokeWidth={2.5} /></button>
                        <button type="button" onClick={() => remove(idx)} className={`p-1.5 ${t.del}`}><Trash2 size={14} strokeWidth={2.5} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      <button type="button" onClick={() => onSave({ itinerary: itin, startDate })} disabled={saving} className="w-full py-4 bg-basel-brick text-white font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black transition-all disabled:opacity-50 flex items-center justify-center gap-2"><Save size={15} strokeWidth={2.5} /> {saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข · Save changes'}</button>
    </div>
  )
}
