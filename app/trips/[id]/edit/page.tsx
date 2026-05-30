'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import ItineraryEditor from '@/app/components/ItineraryEditor'
import type { Itinerary } from '@/lib/itinerary-types'

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

  async function handleSave({ itinerary, startDate }: { itinerary: Itinerary; startDate: string }) {
    setSaving(true)
    try {
      const res = await fetch(`/api/trips/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itinerary, startDate: startDate || null }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error ?? 'บันทึกไม่สำเร็จ')
      }
      router.push('/my-trip')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ')
      setSaving(false)
    }
  }

  return (
    <main className="pt-28 pb-24 px-6 max-w-2xl mx-auto">
      <Link href="/my-trip" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zen-black/50 hover:text-basel-brick transition-colors mb-6">
        <ArrowLeft size={14} strokeWidth={3} /> กลับไปหน้าทริป · Back to My Trip
      </Link>

      {loading ? (
        <p className="text-zen-black/40 font-sans">กำลังโหลด...</p>
      ) : error || !trip ? (
        <div className="border-2 border-dashed border-zen-black/10 rounded-xl p-12 text-center">
          <p className="text-zen-black/60 font-sans">{error ?? 'ไม่พบทริป'}</p>
        </div>
      ) : (
        <>
          <header className="mb-8">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-basel-brick mb-2">แก้ไขแผนการเดินทาง · Edit trip</p>
            <h1 className="text-3xl md:text-4xl font-headline font-extrabold tracking-tighter text-zen-black">{trip.title}</h1>
            <p className="text-zen-black/50 text-sm mt-2 font-sans">
              เลือกตัวเลือก จัดลำดับ ลบกิจกรรม และเพิ่มโน้ตได้ตามต้องการ
            </p>
          </header>

          <ItineraryEditor
            initialItinerary={trip.itinerary}
            initialStartDate={toDateInput(trip.startDate)}
            variant="light"
            saving={saving}
            onSave={handleSave}
          />
        </>
      )}
    </main>
  )
}
