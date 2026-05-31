'use client'

import { Trash2, Plus } from 'lucide-react'
import type { DateRange } from '@/lib/itinerary-types'
import { formatRanges } from '@/lib/availability'

/**
 * Shared availability-window editor — used by the admin Trip Builder AND the
 * dashboard edit modal. Stores year-agnostic "MM-DD" ranges; the <input
 * type="date"> picker uses a fixed display year (2026) — only the month-day is
 * persisted (inputToMMDD strips the year), so the year is cosmetic.
 */
export function mmddToInput(mmdd: string): string {
  return `2026-${mmdd}`
}
export function inputToMMDD(value: string): string {
  return value.slice(5) // "YYYY-MM-DD" → "MM-DD"
}

export default function RangeEditor({
  label,
  hint,
  ranges,
  onChange,
}: {
  label: string
  hint: string
  ranges: DateRange[]
  onChange: (r: DateRange[]) => void
}) {
  function update(i: number, key: 'from' | 'to', value: string) {
    if (!value) return
    onChange(ranges.map((r, idx) => (idx === i ? { ...r, [key]: inputToMMDD(value) } : r)))
  }
  function add() {
    onChange([...ranges, { from: '01-01', to: '12-31' }])
  }
  function remove(i: number) {
    onChange(ranges.filter((_, idx) => idx !== i))
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zen-black/70">{label}</span>
        <span className="text-[9px] text-zen-black/40">{hint}</span>
      </div>

      {ranges.length === 0 ? (
        <p className="text-[10px] text-zen-black/40 italic mb-2">
          {label.startsWith('Available') ? 'ตลอดทั้งปี · open all year' : 'ไม่ได้ระบุ · none set'}
        </p>
      ) : (
        <div className="space-y-2 mb-2">
          {ranges.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="date"
                value={mmddToInput(r.from)}
                onChange={(e) => update(i, 'from', e.target.value)}
                className="flex-1 border border-zen-black/20 px-2 py-1.5 text-xs bg-transparent text-zen-black focus:outline-none focus:border-basel-brick rounded"
              />
              <span className="text-zen-black/40 text-xs">→</span>
              <input
                type="date"
                value={mmddToInput(r.to)}
                onChange={(e) => update(i, 'to', e.target.value)}
                className="flex-1 border border-zen-black/20 px-2 py-1.5 text-xs bg-transparent text-zen-black focus:outline-none focus:border-basel-brick rounded"
              />
              <button
                type="button"
                onClick={() => remove(i)}
                className="p-1.5 text-zen-black/40 hover:text-red-600 transition-colors flex-shrink-0"
                aria-label="Remove range"
              >
                <Trash2 size={13} strokeWidth={2.5} />
              </button>
            </div>
          ))}
          <p className="text-[10px] text-zen-black/50">
            ดูตัวอย่าง: <span className="font-medium">{formatRanges(ranges, 'th')}</span>
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-basel-brick hover:text-zen-black transition-colors"
      >
        <Plus size={12} strokeWidth={3} /> Add window
      </button>
    </div>
  )
}
