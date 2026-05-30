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
  light: { btn: 'bg-briefing-cream border-zen-black/20', value: 'text-zen-black', placeholder: 'text-zen-black/40', chevron: 'text-zen-black/40' },
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
      className="relative rdp-brand"
      style={
        {
          '--rdp-accent-color': '#B43325',
          '--rdp-accent-background-color': '#f1e2de',
          '--rdp-today-color': '#B43325',
          '--rdp-range_middle-color': '#231a0e',
        } as React.CSSProperties
      }
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-3 border px-4 py-3 text-sm font-medium hover:border-basel-brick transition-colors ${tv.btn}`}
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
          {/* Floating overlay — does not shift surrounding content */}
          <div className="absolute left-0 top-full mt-2 z-50 bg-white border border-zen-black/15 shadow-xl p-3 w-max max-w-[calc(100vw-3rem)]">
            <DayPicker
              mode="range"
              min={1}
              selected={value}
              onSelect={onChange}
              numberOfMonths={1}
              disabled={{ before: today }}
              showOutsideDays
            />
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-zen-black/10">
              <button
                type="button"
                onClick={() => onChange(undefined)}
                className="text-[10px] font-black uppercase tracking-widest text-zen-black/40 hover:text-basel-brick transition-colors px-2 py-1.5"
              >
                ล้าง · Clear
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-1.5 bg-basel-brick text-white text-[10px] font-black uppercase tracking-widest hover:bg-zen-black transition-colors"
              >
                เสร็จ · Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
