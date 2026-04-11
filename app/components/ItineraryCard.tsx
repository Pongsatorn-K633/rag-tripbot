'use client'

import { useState } from 'react'
import { ChevronDown, MapPin, Hotel, Train, Clock } from 'lucide-react'

/**
 * Itinerary preview card — white-themed version of the LIFF itinerary view.
 *
 * Used in the template preview modal and the gallery upload review step.
 * Mirrors the LIFF dark-themed accordion (app/liff/itinerary/page.tsx) but
 * with a briefing-cream/white/zen-black palette to fit the main website.
 *
 * The LIFF version (dark theme) is kept as-is for the LINE in-app browser.
 */

interface Activity {
  time: string
  name: string
  notes?: string
}

interface Day {
  day: number
  location: string
  activities: Activity[]
  accommodation: string
  transport: string
}

interface Itinerary {
  title?: string
  totalDays?: number
  season?: string
  days: Day[]
  shareCode?: string | null
}

interface ItineraryCardProps {
  itinerary: Itinerary
  onConfirm: () => void
  confirmLoading?: boolean
}

export default function ItineraryCard({
  itinerary,
  onConfirm,
  confirmLoading = false,
}: ItineraryCardProps) {
  const [openDay, setOpenDay] = useState<number | null>(1)

  const totalDays = itinerary.totalDays ?? itinerary.days.length
  const currentOpenDay = openDay ?? 1

  return (
    <div className="rounded-xl overflow-hidden border border-zen-black/10 bg-white shadow-sm">
      {/* Header */}
      <div className="px-6 py-5 bg-zen-black">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-basel-brick mb-1">
              Travel Dossier
            </p>
            <h2 className="font-headline font-extrabold text-xl tracking-tight text-briefing-cream leading-tight">
              {itinerary.title ?? 'แผนการเดินทาง'}
            </h2>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs font-bold text-briefing-cream/60">
              {totalDays} วัน
              {itinerary.season ? ` · ${itinerary.season}` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Journey section header */}
      <div className="flex items-baseline justify-between px-6 py-4 border-b border-zen-black/5">
        <h3 className="font-headline text-lg font-extrabold text-zen-black">
          The Journey
        </h3>
        <span className="text-[10px] font-bold text-basel-brick uppercase tracking-widest">
          Day {currentOpenDay} / {totalDays}
        </span>
      </div>

      {/* Day accordion */}
      <div className="divide-y divide-zen-black/5">
        {itinerary.days.map((day) => {
          const isOpen = openDay === day.day
          const paddedDay = String(day.day).padStart(2, '0')

          return (
            <div key={day.day}>
              {/* Day header — clickable toggle */}
              <button
                className="w-full text-left px-6 py-4 flex items-center gap-4 hover:bg-briefing-cream/50 transition-colors"
                onClick={() => setOpenDay(isOpen ? null : day.day)}
              >
                {/* Number badge */}
                <span
                  className={[
                    'inline-flex items-center justify-center w-11 h-11 rounded-xl font-black text-lg flex-shrink-0 transition-colors',
                    isOpen
                      ? 'bg-basel-brick text-white'
                      : 'bg-zen-black/5 text-zen-black/40',
                  ].join(' ')}
                >
                  {paddedDay}
                </span>

                {/* Location + subtitle */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-lg text-zen-black leading-tight truncate">
                    {day.location}
                  </p>
                  <p className="text-xs text-zen-black/40 font-medium mt-0.5 flex items-center gap-1">
                    <MapPin size={10} strokeWidth={2.5} />
                    Day {day.day}
                    {day.activities.length > 0 && ` · ${day.activities.length} กิจกรรม`}
                  </p>
                </div>

                {/* Chevron */}
                <ChevronDown
                  size={18}
                  className={[
                    'flex-shrink-0 transition-all duration-200',
                    isOpen
                      ? 'rotate-180 text-basel-brick'
                      : 'rotate-0 text-zen-black/20',
                  ].join(' ')}
                />
              </button>

              {/* Expanded panel */}
              {isOpen && (
                <div className="px-6 pb-6 pt-2 space-y-6 border-t border-zen-black/5 bg-briefing-cream/30">
                  {/* Activities timeline */}
                  {day.activities.length > 0 && (
                    <div className="space-y-5">
                      {day.activities.map((act, idx) => (
                        <div key={idx} className="relative pl-7 border-l-[3px] border-basel-brick">
                          {/* Dot */}
                          <span className="absolute -left-[6px] top-0.5 w-2.5 h-2.5 rounded-full bg-basel-brick" />
                          <p className="text-[10px] font-bold text-basel-brick uppercase tracking-widest flex items-center gap-1">
                            <Clock size={10} strokeWidth={2.5} />
                            {act.time}
                          </p>
                          <p className="font-bold text-base text-zen-black mt-1">
                            {act.name}
                          </p>
                          {act.notes && (
                            <p className="text-sm text-zen-black/60 mt-1.5 leading-relaxed">
                              {act.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Accommodation */}
                  {day.accommodation && (
                    <div className="flex items-start gap-2">
                      <Hotel size={14} className="text-basel-brick flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                      <div>
                        <p className="text-[10px] font-bold text-basel-brick uppercase tracking-widest mb-1">
                          ที่พัก
                        </p>
                        <p className="text-sm text-zen-black leading-relaxed">
                          {day.accommodation}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Transport */}
                  {day.transport && (
                    <div className="flex items-start gap-2">
                      <Train size={14} className="text-basel-brick flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                      <div>
                        <p className="text-[10px] font-bold text-basel-brick uppercase tracking-widest mb-1">
                          การเดินทาง
                        </p>
                        <p className="text-sm text-zen-black leading-relaxed">
                          {day.transport}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Confirm button */}
      <div className="px-6 py-4 bg-white border-t border-zen-black/10">
        <button
          onClick={onConfirm}
          disabled={confirmLoading}
          className="w-full py-4 bg-basel-brick text-white font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black transition-all disabled:opacity-50"
        >
          {confirmLoading ? 'กำลังบันทึก...' : 'Confirm & Sync Itinerary'}
        </button>
      </div>
    </div>
  )
}
