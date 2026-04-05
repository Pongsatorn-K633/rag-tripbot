'use client'

import { useState } from 'react'

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

  return (
    <div className="rounded-xl overflow-hidden shadow-md mt-3 mb-2" style={{ border: '1px solid #1a2744' }}>
      {/* Header */}
      <div className="px-5 py-4" style={{ backgroundColor: '#1a2744' }}>
        <h2 className="text-lg font-semibold" style={{ color: '#c9a84c' }}>
          {itinerary.title ?? 'แผนการเดินทาง'}
        </h2>
        <p className="text-sm mt-1" style={{ color: '#a0aec0' }}>
          {itinerary.totalDays ? `${itinerary.totalDays} วัน` : ''}
          {itinerary.season ? ` · ${itinerary.season}` : ''}
        </p>
      </div>

      {/* Day accordion */}
      <div className="divide-y divide-gray-100 bg-white">
        {itinerary.days.map((day) => {
          const isOpen = openDay === day.day
          return (
            <div key={day.day}>
              {/* Day header — clickable toggle */}
              <button
                className="w-full text-left px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                onClick={() => setOpenDay(isOpen ? null : day.day)}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: '#1a2744', color: '#c9a84c' }}
                  >
                    {day.day}
                  </span>
                  <span className="font-medium text-sm" style={{ color: '#1a2744' }}>
                    {day.location}
                  </span>
                </div>
                <span className="text-xs" style={{ color: '#c9a84c' }}>
                  {isOpen ? '▲' : '▼'}
                </span>
              </button>

              {/* Day detail */}
              {isOpen && (
                <div className="px-5 pb-4 pt-1 bg-gray-50">
                  {/* Activities */}
                  <div className="mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#c9a84c' }}>
                      กิจกรรม
                    </p>
                    <ul className="space-y-2">
                      {day.activities.map((act, idx) => (
                        <li key={idx} className="flex gap-3 text-sm">
                          <span
                            className="flex-shrink-0 font-mono text-xs pt-0.5"
                            style={{ color: '#1a2744', minWidth: '3.5rem' }}
                          >
                            {act.time}
                          </span>
                          <div>
                            <span className="font-medium" style={{ color: '#1a2744' }}>
                              {act.name}
                            </span>
                            {act.notes && (
                              <p className="text-xs text-gray-500 mt-0.5">{act.notes}</p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Accommodation */}
                  <div className="mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#c9a84c' }}>
                      ที่พัก
                    </p>
                    <p className="text-sm" style={{ color: '#374151' }}>{day.accommodation}</p>
                  </div>

                  {/* Transport */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#c9a84c' }}>
                      การเดินทาง
                    </p>
                    <p className="text-sm" style={{ color: '#374151' }}>{day.transport}</p>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Confirm button */}
      <div className="px-5 py-4" style={{ backgroundColor: '#f9fafb', borderTop: '1px solid #e5e7eb' }}>
        <button
          onClick={onConfirm}
          disabled={confirmLoading}
          className="w-full py-3 rounded-lg font-semibold text-sm transition-opacity disabled:opacity-60"
          style={{ backgroundColor: '#1a2744', color: '#c9a84c' }}
        >
          {confirmLoading ? 'กำลังบันทึก...' : 'ยืนยันและบันทึกแผนการเดินทาง'}
        </button>
      </div>
    </div>
  )
}
