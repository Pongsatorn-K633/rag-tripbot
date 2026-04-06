'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openDay, setOpenDay] = useState<number | null>(1)

  useEffect(() => {
    if (!shareCode) {
      setError('ไม่พบรหัสแผนการเดินทาง')
      setLoading(false)
      return
    }

    fetch(`/api/trips/by-code?shareCode=${encodeURIComponent(shareCode)}`)
      .then((res) => {
        if (!res.ok) throw new Error('ไม่พบแผนการเดินทาง')
        return res.json()
      })
      .then((data) => {
        setItinerary(data.itinerary)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [shareCode])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0f1a2e' }}>
        <p style={{ color: '#c9a84c' }}>กำลังโหลดแผนการเดินทาง...</p>
      </div>
    )
  }

  if (error || !itinerary) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0f1a2e' }}>
        <p style={{ color: '#ff6b6b' }}>{error ?? 'เกิดข้อผิดพลาด'}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0f1a2e' }}>
      {/* Header */}
      <div className="px-5 py-6" style={{ backgroundColor: '#1a2744' }}>
        <h1 className="text-xl font-bold" style={{ color: '#c9a84c' }}>
          {itinerary.title ?? 'แผนการเดินทาง'}
        </h1>
        <p className="text-sm mt-1" style={{ color: '#a0aec0' }}>
          {itinerary.totalDays ? `${itinerary.totalDays} วัน` : ''}
          {itinerary.season ? ` · ${itinerary.season}` : ''}
        </p>
      </div>

      {/* Day list */}
      <div className="divide-y" style={{ borderColor: '#1a2744' }}>
        {itinerary.days.map((day) => {
          const isOpen = openDay === day.day
          return (
            <div key={day.day}>
              <button
                className="w-full text-left px-5 py-4 flex items-center justify-between"
                style={{ backgroundColor: isOpen ? '#1a2744' : '#0f1a2e' }}
                onClick={() => setOpenDay(isOpen ? null : day.day)}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold flex-shrink-0"
                    style={{ backgroundColor: '#c9a84c', color: '#1a2744' }}
                  >
                    {day.day}
                  </span>
                  <span className="font-medium" style={{ color: '#e2e8f0' }}>
                    {day.location}
                  </span>
                </div>
                <span style={{ color: '#c9a84c' }}>
                  {isOpen ? '▲' : '▼'}
                </span>
              </button>

              {isOpen && (
                <div className="px-5 pb-5 pt-2" style={{ backgroundColor: '#1a2744' }}>
                  {/* Activities */}
                  <div className="mb-4">
                    <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#c9a84c' }}>
                      กิจกรรม
                    </p>
                    <ul className="space-y-2">
                      {day.activities.map((act, idx) => (
                        <li key={idx} className="flex gap-3 text-sm">
                          <span className="flex-shrink-0 font-mono text-xs pt-0.5" style={{ color: '#c9a84c', minWidth: '3.5rem' }}>
                            {act.time}
                          </span>
                          <div>
                            <span className="font-medium" style={{ color: '#e2e8f0' }}>
                              {act.name}
                            </span>
                            {act.notes && (
                              <p className="text-xs mt-0.5" style={{ color: '#a0aec0' }}>{act.notes}</p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Accommodation */}
                  <div className="mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#c9a84c' }}>
                      ที่พัก
                    </p>
                    <p className="text-sm" style={{ color: '#e2e8f0' }}>{day.accommodation}</p>
                  </div>

                  {/* Transport */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#c9a84c' }}>
                      การเดินทาง
                    </p>
                    <p className="text-sm" style={{ color: '#e2e8f0' }}>{day.transport}</p>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function LiffItineraryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0f1a2e' }}>
        <p style={{ color: '#c9a84c' }}>กำลังโหลด...</p>
      </div>
    }>
      <ItineraryContent />
    </Suspense>
  )
}
