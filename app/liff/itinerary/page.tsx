'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { ChevronDown } from 'lucide-react'
import { IMG } from '@/lib/images'

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

function ItineraryContent() {
  const searchParams = useSearchParams()
  // LIFF wraps query params in liff.state — parse it to extract shareCode
  let shareCode = searchParams.get('shareCode')
  if (!shareCode) {
    const liffState = searchParams.get('liff.state')
    if (liffState) {
      const stateParams = new URLSearchParams(liffState.replace(/^\?/, ''))
      shareCode = stateParams.get('shareCode')
    }
  }
  const [itinerary, setItinerary] = useState<Itinerary | null>(null)
  const [tripStartDate, setTripStartDate] = useState<string | null>(null)
  // Derive initial state from shareCode so we don't have to setState
  // synchronously inside the effect (which the React 19 lint rule forbids).
  const [loading, setLoading] = useState<boolean>(() => Boolean(shareCode))
  const [error, setError] = useState<string | null>(() =>
    shareCode ? null : 'ไม่พบรหัสแผนการเดินทาง',
  )
  const [openDay, setOpenDay] = useState<number | null>(1)

  useEffect(() => {
    if (!shareCode) return

    fetch(`/api/trips/by-code?shareCode=${encodeURIComponent(shareCode)}`)
      .then((res) => {
        if (!res.ok) throw new Error('ไม่พบแผนการเดินทาง')
        return res.json()
      })
      .then((data) => {
        setItinerary(data.itinerary)
        setTripStartDate(data.startDate ?? null)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [shareCode])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <p className="text-briefing-cream/60 font-sans text-base">กำลังโหลดแผนการเดินทาง...</p>
      </div>
    )
  }

  if (error || !itinerary) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <p className="text-red-400 font-sans text-base">{error ?? 'เกิดข้อผิดพลาด'}</p>
      </div>
    )
  }

  const totalDays = itinerary.totalDays ?? itinerary.days.length
  const firstDayLocation = itinerary.days[0]?.location ?? ''
  const currentOpenDay = openDay ?? 1

  const heroSubtitle = (() => {
    if (tripStartDate) {
      const start = new Date(tripStartDate)
      const end = new Date(tripStartDate)
      end.setDate(end.getDate() + totalDays - 1)
      const fmt = (d: Date) => d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
      return `${fmt(start)} \u2013 ${fmt(end)} \u2022 ${firstDayLocation}`
    }
    return `${totalDays} วัน \u2022 ${firstDayLocation}`
  })()

  return (
    <div className="min-h-screen bg-black font-sans">
      {/* Top bar */}
      <header
        className="fixed top-0 w-full z-50 border-b border-white/5"
        style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
      >
        <div className="flex items-center gap-3 px-5 py-4 max-w-lg mx-auto">
          <img
            alt="dopamichi logo"
            className="h-7 w-7 object-contain"
            src={IMG.logo}
          />
          <span className="font-headline font-bold tracking-tighter text-briefing-cream text-lg">
            dopamichi
          </span>
        </div>
      </header>

      {/* Main content — offset for fixed top bar */}
      <main className="pt-[64px] pb-16 px-4 max-w-lg mx-auto">
        {/* Hero section */}
        <div className="mb-10 relative overflow-hidden rounded-2xl h-72 flex flex-col justify-end p-8">
          {/* Background image */}
          <img
            src={IMG.liffHero}
            alt="Japan scenery"
            className="absolute inset-0 w-full h-full object-cover grayscale brightness-50"
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          {/* Content */}
          <div className="relative z-10">
            <span className="text-basel-brick text-sm font-bold uppercase tracking-[0.2em] mb-3 block">
              Travel Dossier
            </span>
            <h1 className="font-headline text-5xl font-extrabold tracking-tight text-briefing-cream leading-none">
              {itinerary.title ?? 'แผนการเดินทาง'}
            </h1>
            <p className="text-briefing-cream/60 text-base mt-2 font-medium">
              {heroSubtitle}
            </p>
          </div>
        </div>

        {/* The Journey section */}
        <div>
          {/* Section header */}
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="font-headline text-2xl font-extrabold text-briefing-cream">
              The Journey
            </h2>
            <span className="text-xs font-bold text-basel-brick uppercase tracking-widest">
              Day {currentOpenDay} / {totalDays}
            </span>
          </div>

          {/* Day cards */}
          <div className="space-y-4">
            {itinerary.days.map((day) => {
              const isOpen = openDay === day.day
              const paddedDay = String(day.day).padStart(2, '0')

              return (
                <div
                  key={day.day}
                  className="border border-white/10 rounded-2xl overflow-hidden"
                  style={{ backgroundColor: '#0A0A0A' }}
                >
                  {/* Summary row */}
                  <button
                    className="w-full text-left px-6 py-5 flex items-center gap-4"
                    onClick={() => setOpenDay(isOpen ? null : day.day)}
                  >
                    {/* Number badge */}
                    <span
                      className={[
                        'inline-flex items-center justify-center w-12 h-12 rounded-xl font-black text-xl flex-shrink-0 transition-colors',
                        isOpen
                          ? 'bg-basel-brick text-briefing-cream'
                          : 'bg-white/5 text-briefing-cream/40',
                      ].join(' ')}
                    >
                      {paddedDay}
                    </span>

                    {/* Location + subtitle */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xl text-briefing-cream leading-tight truncate">
                        {day.location}
                      </p>
                      <p className="text-sm text-briefing-cream/40 font-medium mt-0.5">
                        Day {day.day}
                      </p>
                    </div>

                    {/* Chevron */}
                    <ChevronDown
                      size={20}
                      className={[
                        'flex-shrink-0 transition-all duration-200',
                        isOpen
                          ? 'rotate-180 text-basel-brick'
                          : 'rotate-0 text-briefing-cream/20',
                      ].join(' ')}
                    />
                  </button>

                  {/* Expanded panel */}
                  {isOpen && (
                    <div className="px-6 pb-8 pt-2 space-y-10 border-t border-white/5">
                      {/* Activities timeline */}
                      {day.activities.length > 0 && (
                        <div className="space-y-6">
                          {day.activities.map((act, idx) => (
                            <div key={idx} className="relative pl-8 border-l-[3px] border-basel-brick">
                              {/* Dot */}
                              <span className="absolute -left-[6px] top-0 w-2.5 h-2.5 rounded-full bg-basel-brick" />
                              <p className="text-xs font-bold text-basel-brick uppercase tracking-widest">
                                {act.time}
                              </p>
                              <p className="font-bold text-lg text-briefing-cream mt-1">
                                {act.name}
                              </p>
                              {act.notes && (
                                <p className="text-base text-briefing-cream/60 mt-2 leading-relaxed">
                                  {act.notes}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Accommodation */}
                      {day.accommodation && (
                        <div>
                          <p className="text-xs font-bold text-basel-brick uppercase tracking-widest mb-2">
                            ที่พัก
                          </p>
                          <p className="text-base text-briefing-cream leading-relaxed">
                            {day.accommodation}
                          </p>
                        </div>
                      )}

                      {/* Transport */}
                      {day.transport && (
                        <div>
                          <p className="text-xs font-bold text-basel-brick uppercase tracking-widest mb-2">
                            การเดินทาง
                          </p>
                          <p className="text-base text-briefing-cream leading-relaxed">
                            {day.transport}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}

export default function LiffItineraryPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-black">
          <p className="text-briefing-cream/60 font-sans text-base">กำลังโหลด...</p>
        </div>
      }
    >
      <ItineraryContent />
    </Suspense>
  )
}
