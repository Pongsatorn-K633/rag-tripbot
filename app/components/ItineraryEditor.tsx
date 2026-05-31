'use client'

import { useState } from 'react'
import {
  ChevronDown, ChevronUp, Trash2, Clock, CalendarDays, Check, Star, Save, CalendarCheck,
} from 'lucide-react'
import type { Itinerary, Day, Choice } from '@/lib/itinerary-types'
import { isV2 } from '@/lib/trips/itinerary-model'
import CategoryIcon from '@/app/components/CategoryIcon'

/**
 * Shared light-edit itinerary editor — used by BOTH the website edit page and
 * the LINE LIFF edit page. Mobile-first (up/down reorder, no drag library) and
 * theme-aware via `variant`.
 *
 * Supported edits: set start date · pick one option per choice group ·
 * reorder / remove activities · add per-activity notes.
 */
const V = {
  light: {
    card: 'bg-white border-zen-black/10', text: 'text-zen-black', sub: 'text-zen-black/50',
    input: 'bg-briefing-cream border-zen-black/20 text-zen-black', icon: 'text-zen-black/40 hover:text-basel-brick',
    del: 'text-zen-black/40 hover:text-red-600', chip: 'border-zen-black/20 text-zen-black', divider: 'border-zen-black/10',
    badge: 'bg-zen-black/5 text-zen-black/50', daySummary: 'hover:bg-briefing-cream/60',
  },
  dark: {
    card: 'bg-[#0A0A0A] border-white/10', text: 'text-briefing-cream', sub: 'text-briefing-cream/50',
    input: 'bg-white/5 border-white/15 text-briefing-cream', icon: 'text-briefing-cream/40 hover:text-basel-brick',
    del: 'text-briefing-cream/40 hover:text-red-400', chip: 'border-white/15 text-briefing-cream', divider: 'border-white/10',
    badge: 'bg-white/5 text-briefing-cream/50', daySummary: 'hover:bg-white/5',
  },
} as const

type EditorTokens = (typeof V)[keyof typeof V]

export default function ItineraryEditor({
  initialItinerary,
  initialStartDate = '',
  variant = 'light',
  saving = false,
  onSave,
}: {
  initialItinerary: Itinerary
  initialStartDate?: string
  variant?: 'light' | 'dark'
  saving?: boolean
  onSave: (data: { itinerary: Itinerary; startDate: string }) => void
}) {
  const t = V[variant]
  const [itin, setItin] = useState<Itinerary>(initialItinerary)
  const [startDate, setStartDate] = useState(initialStartDate)
  const [openDay, setOpenDay] = useState<number | null>(itin.days[0]?.day ?? null)
  // v2 (node/slot) trips: the light day-editor doesn't speak slots yet, so we keep
  // the start-date edit and skip the day list (view it in My Trip). Follow-up.
  const v2 = isV2(initialItinerary)

  function updateDay(dayIdx: number, updater: (d: Day) => Day) {
    setItin((prev) => ({ ...prev, days: prev.days.map((d, i) => (i === dayIdx ? updater(d) : d)) }))
  }
  function moveActivity(dayIdx: number, actIdx: number, dir: -1 | 1) {
    updateDay(dayIdx, (d) => {
      const acts = [...d.activities]
      const j = actIdx + dir
      if (j < 0 || j >= acts.length) return d
      ;[acts[actIdx], acts[j]] = [acts[j], acts[actIdx]]
      return { ...d, activities: acts }
    })
  }
  function removeActivity(dayIdx: number, actIdx: number) {
    updateDay(dayIdx, (d) => ({ ...d, activities: d.activities.filter((_, i) => i !== actIdx) }))
  }
  function setNote(dayIdx: number, actIdx: number, note: string) {
    updateDay(dayIdx, (d) => ({
      ...d,
      activities: d.activities.map((a, i) => (i === actIdx ? { ...a, notes: note } : a)),
    }))
  }
  function pickChoice(dayIdx: number, choiceIdx: number, optIdx: number) {
    updateDay(dayIdx, (d) => ({
      ...d,
      choices: d.choices?.map((c, i) => (i === choiceIdx ? { ...c, selected: c.selected === optIdx ? undefined : optIdx } : c)),
    }))
  }

  return (
    <div className="space-y-5">
      {/* Start date */}
      <div className={`border p-4 ${t.card}`}>
        <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-basel-brick mb-2">
          <CalendarDays size={13} strokeWidth={2.5} /> วันเริ่มเดินทาง · Start date
        </label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className={`w-full border px-3 py-2.5 text-sm font-medium focus:outline-none focus:border-basel-brick transition-colors ${t.input}`}
        />
      </div>

      {/* Days */}
      {v2 && (
        <div className={`border p-4 text-sm leading-relaxed ${t.card} ${t.sub}`}>
          ทริปนี้ใช้รูปแบบใหม่ (node/slot) — การแก้ไขรายวันแบบละเอียดกำลังจะมา ดูแผนเต็มได้ที่หน้า My Trip
          ส่วนวันเริ่มเดินทางยังแก้ไขได้ที่นี่
        </div>
      )}
      {!v2 && itin.days.map((day, dayIdx) => {
        const isOpen = openDay === day.day
        return (
          <div key={day.day} className={`border overflow-hidden ${t.card}`}>
            <button
              type="button"
              onClick={() => setOpenDay(isOpen ? null : day.day)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${t.daySummary}`}
            >
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-basel-brick text-white font-black text-sm flex-shrink-0">
                {String(day.day).padStart(2, '0')}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-base leading-tight truncate ${t.text}`}>{day.location}</p>
                <p className={`text-[11px] ${t.sub}`}>{day.activities.length} กิจกรรม{day.choices?.length ? ` · ${day.choices.length} ตัวเลือก` : ''}</p>
              </div>
              <ChevronDown size={18} className={`flex-shrink-0 transition-transform ${t.icon} ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
              <div className={`border-t px-4 py-4 space-y-5 ${t.divider}`}>
                {day.free && day.activities.length === 0 && (!day.choices || day.choices.length === 0) && (
                  <div className="flex items-center gap-2 text-xs bg-emerald-50 text-emerald-900 rounded-lg px-3 py-2.5">
                    <CalendarCheck size={14} className="text-emerald-600 flex-shrink-0" strokeWidth={2.5} />
                    <span>วันอิสระ — วางแผนวันนี้ได้ตามใจ</span>
                  </div>
                )}
                {/* Activities */}
                {day.activities.length > 0 && (
                  <div className="space-y-3">
                    {day.activities.map((act, actIdx) => (
                      <div key={actIdx} className={`border p-3 ${t.divider}`}>
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {act.time && (
                                <span className="text-[10px] font-bold text-basel-brick uppercase tracking-widest flex items-center gap-1">
                                  <Clock size={10} strokeWidth={2.5} /> {act.time}
                                </span>
                              )}
                              {act.category && <CategoryIcon category={act.category} size={12} className={t.sub} />}
                            </div>
                            <p className={`font-bold text-sm mt-0.5 ${t.text}`}>{act.name}</p>
                          </div>
                          {/* Reorder + remove controls */}
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button type="button" onClick={() => moveActivity(dayIdx, actIdx, -1)} disabled={actIdx === 0} aria-label="Move up" className={`p-1.5 disabled:opacity-20 ${t.icon}`}>
                              <ChevronUp size={15} strokeWidth={2.5} />
                            </button>
                            <button type="button" onClick={() => moveActivity(dayIdx, actIdx, 1)} disabled={actIdx === day.activities.length - 1} aria-label="Move down" className={`p-1.5 disabled:opacity-20 ${t.icon}`}>
                              <ChevronDown size={15} strokeWidth={2.5} />
                            </button>
                            <button type="button" onClick={() => removeActivity(dayIdx, actIdx)} aria-label="Remove" className={`p-1.5 ${t.del}`}>
                              <Trash2 size={14} strokeWidth={2.5} />
                            </button>
                          </div>
                        </div>
                        <input
                          type="text"
                          value={act.notes ?? ''}
                          onChange={(e) => setNote(dayIdx, actIdx, e.target.value)}
                          placeholder="เพิ่มโน้ต · Add a note"
                          className={`w-full mt-2 border px-2.5 py-1.5 text-xs focus:outline-none focus:border-basel-brick transition-colors ${t.input}`}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Choices — pick one per group */}
                {day.choices && day.choices.length > 0 && (
                  <div className="space-y-3">
                    {day.choices.map((choice, choiceIdx) => (
                      <ChoiceEditor
                        key={choiceIdx}
                        choice={choice}
                        t={t}
                        onPick={(optIdx) => pickChoice(dayIdx, choiceIdx, optIdx)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Save */}
      <button
        type="button"
        onClick={() => onSave({ itinerary: itin, startDate })}
        disabled={saving}
        className="w-full py-4 bg-basel-brick text-white font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <Save size={15} strokeWidth={2.5} /> {saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข · Save changes'}
      </button>
    </div>
  )
}

// ── Choice picker ──────────────────────────────────────────────────────────

function ChoiceEditor({
  choice,
  t,
  onPick,
}: {
  choice: Choice
  t: EditorTokens
  onPick: (optIdx: number) => void
}) {
  return (
    <div className="border border-blue-300/50 bg-blue-50/10">
      <div className="px-3 py-2 flex items-center gap-2 border-b border-blue-300/30">
        <Star size={11} className="text-blue-500" strokeWidth={2.5} />
        <p className={`text-[10px] font-bold uppercase tracking-widest flex-1 ${t.sub}`}>{choice.label}</p>
        <span className="text-[8px] font-black uppercase tracking-widest text-blue-500">เลือก 1</span>
      </div>
      <div className="p-2 space-y-2">
        {choice.options.map((opt, optIdx) => {
          const picked = choice.selected === optIdx
          return (
            <button
              key={optIdx}
              type="button"
              onClick={() => onPick(optIdx)}
              className={`w-full text-left border px-3 py-2 transition-all flex items-center gap-2 ${
                picked ? 'border-basel-brick bg-basel-brick/10' : `${t.chip} hover:border-basel-brick`
              }`}
            >
              <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 border ${picked ? 'bg-basel-brick border-basel-brick' : 'border-current opacity-40'}`}>
                {picked && <Check size={11} className="text-white" strokeWidth={3} />}
              </span>
              <span className={`flex-1 min-w-0`}>
                <span className={`block font-bold text-sm ${t.text}`}>{opt.name}</span>
                {opt.notes && <span className={`block text-[11px] ${t.sub}`}>{opt.notes}</span>}
              </span>
              {opt.cost && <span className="text-[10px] font-bold text-basel-brick flex-shrink-0">{opt.cost}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
