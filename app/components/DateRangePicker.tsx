'use client'

import { useState } from 'react'
import { DayPicker, type DateRange } from 'react-day-picker'
import { CalendarDays, ChevronDown } from 'lucide-react'
import 'react-day-picker/style.css'

function fmt(d?: Date): string {
  return d ? d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
}

/**
 * Branded travel-window picker built on react-day-picker (range mode).
 * Opens as an OVERLAY (absolute popover) so it floats above content instead of
 * pushing the layout. `min={1}` makes the first click set only the start day
 * (incomplete range) so the second click cleanly sets the end. Themed to the
 * basel-brick / cream palette via CSS variables on the wrapper.
 */
const TRIGGER_VARIANT = {
  // Placeholder is full zen-black (not faded): it matches FilterSelect, whose
  // "ทั้งหมด · All" empty state renders at full color too.
  light: { btn: 'bg-white border-zen-black/15', value: 'text-zen-black', placeholder: 'text-zen-black', chevron: 'text-graphite/60' },
  dark: { btn: 'bg-white/5 border-white/15', value: 'text-briefing-cream', placeholder: 'text-briefing-cream/40', chevron: 'text-briefing-cream/40' },
} as const

export default function DateRangePicker({
  value,
  onChange,
  variant = 'light',
}: {
  value: DateRange | undefined
  onChange: (range: DateRange | undefined) => void
  /** Trigger button theme. The calendar popover stays light for readability. */
  variant?: 'light' | 'dark'
}) {
  const [open, setOpen] = useState(false)
  const tv = TRIGGER_VARIANT[variant]

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const label = value?.from
    ? value.to && value.to.getTime() !== value.from.getTime()
      ? `${fmt(value.from)} – ${fmt(value.to)}`
      : `${fmt(value.from)} →  เลือกวันสิ้นสุด`
    : 'เลือกช่วงวันเดินทาง · Select dates'

  return (
    <div
      // font-detail: react-day-picker's day/nav <button>s inherit family, but
      // pinning it here guarantees the calendar matches the filter UI (Plus
      // Jakarta Sans) regardless of the surrounding context's font.
      className="relative rdp-brand font-detail"
      // Cool-palette calendar theme (Ocean accent + Midnight text). The old
      // values here were warm-era reds — the one place the 2026-07 palette
      // migration missed.
      style={
        {
          '--rdp-accent-color': '#5B88B2',
          '--rdp-accent-background-color': '#E7EEF5',
          '--rdp-today-color': '#5B88B2',
          '--rdp-range_middle-color': '#122C4F',
        } as React.CSSProperties
      }
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold hover:border-basel-brick/50 transition-colors ${tv.btn}`}
      >
        <span className="flex items-center gap-2.5">
          <CalendarDays size={16} className="text-basel-brick" strokeWidth={2.5} />
          <span className={value?.from ? tv.value : tv.placeholder}>{label}</span>
        </span>
        <ChevronDown
          size={16}
          className={`${tv.chevron} transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <>
          {/* Backdrop — closes on outside click without affecting layout */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          {/* Floating overlay — does not shift surrounding content.
              text-zen-black is explicit: the popover renders inside light-on-dark
              contexts too (home's filter modal), where inherited text color made
              the calendar invisible. */}
          <div className="absolute left-0 top-full mt-2 z-50 bg-white text-zen-black border border-zen-black/15 rounded-xl shadow-xl p-3 w-max max-w-[calc(100vw-3rem)]">
            <DayPicker
              mode="range"
              min={1}
              selected={value}
              onSelect={onChange}
              defaultMonth={value?.from ?? today}
              numberOfMonths={1}
              disabled={{ before: today }}
              showOutsideDays
            />
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-zen-black/10">
              <button
                type="button"
                onClick={() => onChange(undefined)}
                className="px-2 py-1.5 text-xs font-semibold text-graphite/70 hover:text-basel-brick transition-colors"
              >
                Reset
              </button>
              {/* Same treatment as the filter modal's header Done (text Ocean,
                  Ocean-tint hover) — not a filled pill. */}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold text-basel-brick transition-colors hover:bg-basel-brick/10"
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
