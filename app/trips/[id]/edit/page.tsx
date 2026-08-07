'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import ItineraryEditor from '@/app/components/ItineraryEditor'
import ItineraryEditorV3 from '@/app/components/ItineraryEditorV3'
import { isV3 } from '@/lib/trips/itinerary-model'
import type { Itinerary, ItineraryV3 } from '@/lib/itinerary-types'

interface TripData {
  title: string
  itinerary: Itinerary
  startDate: string | null
  shareCode: string | null
}

/** Format a stored DateTime to a local "YYYY-MM-DD" for <input type="date">. */
function toDateInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function EditTripPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [trip, setTrip] = useState<TripData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/trips/${id}`)
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error ?? 'โหลดไม่สำเร็จ')
        return data
      })
      .then((d) => { setTrip(d.trip); setLoading(false) })
      .catch((e) => { setError(e.message); setLoading(false) })
  }, [id])

  async function handleSave({ itinerary, startDate, title }: { itinerary: Itinerary | ItineraryV3; startDate: string; title?: string }) {
    setSaving(true)
    try {
      const res = await fetch(`/api/trips/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itinerary, startDate: startDate || null, title }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error ?? 'บันทึกไม่สำเร็จ')
      }
      router.push('/my-trips')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ')
      setSaving(false)
    }
  }

  return (
    <main className="pt-28 pb-24 px-6 max-w-2xl mx-auto">
      <Link
        href="/my-trips"
        className="group mb-6 inline-flex items-center gap-1.5 font-headline text-xs font-bold tracking-wide text-graphite/70 transition-colors hover:text-basel-brick"
      >
        <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-1" strokeWidth={2.5} />
        Back to My Trips
      </Link>

      {loading ? (
        <p className="font-detail text-[13px] text-graphite/60">กำลังโหลด...</p>
      ) : error || !trip ? (
        <div className="rounded-2xl border-2 border-dashed border-zen-black/10 p-12 text-center">
          <p className="font-detail text-sm text-graphite/70">{error ?? 'ไม่พบทริป'}</p>
        </div>
      ) : (
        <>
          <header className="mb-8">
            <h1 className="font-headline text-3xl font-bold tracking-tight text-zen-black md:text-4xl">
              Edit Trip
            </h1>
            <p className="mt-2.5 font-sans text-graphite/70">
              {trip.title} — แก้ไขได้ทุกอย่าง: วัน กิจกรรม เวลา ลิงก์ และตัวเลือกร้านอาหาร
            </p>
          </header>

          {isV3(trip.itinerary) ? (
            <ItineraryEditorV3
              initialItinerary={trip.itinerary as unknown as ItineraryV3}
              initialStartDate={toDateInput(trip.startDate)}
              initialTitle={trip.title}
              saving={saving}
              onSave={handleSave}
            />
          ) : (
            <ItineraryEditor
              initialItinerary={trip.itinerary}
              initialStartDate={toDateInput(trip.startDate)}
              variant="light"
              saving={saving}
              onSave={handleSave}
            />
          )}
        </>
      )}
    </main>
  )
}
