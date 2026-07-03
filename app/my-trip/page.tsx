'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Trash2, ArrowRight, Shield, Plane, Zap, Copy, Pencil, Check } from 'lucide-react'
import ItineraryView from '@/app/components/ItineraryView'
import { motion, AnimatePresence } from 'motion/react'
import { useSession, signIn } from 'next-auth/react'
import { IMG } from '@/lib/images'
import { resolveCoverImage } from '@/lib/cover-image'
import type { Itinerary, AnyItinerary } from '@/lib/itinerary-types'
import { makeDayOneFree, hasTrailingFreeDay } from '@/lib/trips/extend'
import ConfirmDialog from '@/app/components/ConfirmDialog'

// ── Types ────────────────────────────────────────────────────────────────────

interface SavedTrip {
  id: string
  title: string
  createdAt: string
  itinerary: Itinerary
  startDate?: string | null
  source?: string | null
  shareCode?: string | null
  templateId?: string | null
  coverImage?: string | null
  totalDays?: number | null
  locked?: boolean
}

const STOCK_IMAGES = [IMG.stock1, IMG.stock2, IMG.stock3, IMG.stock4]

export default function GoPage() {
  const { data: session, status } = useSession()
  const isSignedIn = !!session?.user

  const [trips, setTrips] = useState<SavedTrip[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [viewingTripId, setViewingTripId] = useState<string | null>(null)
  const [makeFreeTripId, setMakeFreeTripId] = useState<string | null>(null)
  const [generatingCode, setGeneratingCode] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  // Copy "/activate <code>" to the clipboard and flash a "copied" indicator.
  function copyCode(code: string, e?: React.MouseEvent) {
    e?.stopPropagation() // don't open/close the view modal
    navigator.clipboard.writeText(`/activate ${code}`)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode((c) => (c === code ? null : c)), 1800)
  }

  async function handleGenerateCode(tripId: string, e: React.MouseEvent) {
    e.stopPropagation() // don't open the view modal
    setGeneratingCode(tripId)
    try {
      const trip = trips.find((t) => t.id === tripId)
      const primaryCity = (trip?.itinerary as Itinerary | null)?.days?.[0]?.location ?? 'JPN'
      const res = await fetch('/api/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId, primaryCity }),
      })
      if (!res.ok) throw new Error('Generate failed')
      const { shareCode } = await res.json()
      setTrips((prev) =>
        prev.map((t) => (t.id === tripId ? { ...t, shareCode } : t))
      )
    } catch {
      alert('ไม่สามารถสร้างรหัสได้ กรุณาลองใหม่')
    } finally {
      setGeneratingCode(null)
    }
  }

  // Late arrival → turn Day 1 into a free arrival day (keeps the trip length:
  // absorbs a trailing free day if there is one, otherwise drops Day 1's plan).
  async function handleMakeDayFree(tripId: string) {
    const trip = trips.find((t) => t.id === tripId)
    if (!trip?.itinerary) return
    const prev = trip.itinerary
    const next = makeDayOneFree(prev as unknown as AnyItinerary)
    setTrips((ts) => ts.map((t) => (t.id === tripId ? { ...t, itinerary: next as unknown as Itinerary } : t)))
    try {
      const res = await fetch(`/api/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itinerary: next }),
      })
      if (!res.ok) throw new Error('save failed')
    } catch {
      setTrips((ts) => ts.map((t) => (t.id === tripId ? { ...t, itinerary: prev } : t)))
      alert('บันทึกไม่สำเร็จ กรุณาลองใหม่')
    }
  }

  useEffect(() => {
    if (status === 'loading') return
    if (!isSignedIn) { setLoading(false); return }
    async function loadTrips() {
      try {
        const res = await fetch('/api/trips')
        if (!res.ok) throw new Error('Failed to load')
        const data = await res.json()
        // Show ALL user trips — uploads, chat, and template-sourced.
        // Template-sourced trips are real travel plans (user will edit + generate LINE code).
        setTrips(data.trips ?? [])
      } catch { /* silent */ } finally { setLoading(false) }
    }
    loadTrips()
  }, [isSignedIn, status])

  async function handleDelete(id: string) {
    setDeleting(true)
    try {
      const res = await fetch(`/api/trips/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (res.status === 409) {
          setDeleteConfirm(null)
          alert(body.error ?? 'This trip is published as a template and cannot be deleted.')
          return
        }
        throw new Error(body.error ?? 'Delete failed')
      }
      setDeleteConfirm(null)
      setTrips((prev) => prev.filter((t) => t.id !== id))
    } catch {
      alert('ไม่สามารถลบแผนได้ กรุณาลองใหม่')
      setDeleteConfirm(null)
    } finally { setDeleting(false) }
  }

  function formatDateRange(startDateStr: string, days: number): string {
    const start = new Date(startDateStr)
    const end = new Date(startDateStr)
    end.setDate(end.getDate() + days - 1)
    const fmt = (d: Date) => d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
    return `${fmt(start)} - ${fmt(end)}`
  }

  return (
    <main className="pt-24 sm:pt-32 pb-16 sm:pb-24 px-4 sm:px-6 max-w-7xl mx-auto">
      {/* Hero */}
      <header className="mb-20">
        <h1 className="text-4xl md:text-5xl lg:text-7xl font-headline font-extrabold tracking-tighter text-basel-brick mb-6">
          My Trip
        </h1>
        <p className="text-zen-black/70 text-lg max-w-3xl leading-relaxed font-sans">
          ทริปของคุณ — แก้ไขได้อิสระ และใช้ share code เพื่อ activate บน LINE แล้วออกไปเที่ยวได้เลย
        </p>
        <p className="text-zen-black/40 text-sm mt-1 font-sans">
          Your trips — edit freely, then activate on LINE and go!
        </p>
      </header>

      {/* Sign-in CTA for guests */}
      {!isSignedIn && !loading && (
        <div className="border-2 border-dashed border-zen-black/10 rounded-xl p-8 sm:p-16 text-center mb-20">
          <Plane size={40} className="mx-auto mb-4 text-zen-black/20" />
          <p className="text-zen-black/60 text-lg mb-2 font-sans">สมัครสมาชิกเพื่อดูแผนการเดินทางของคุณ</p>
          <p className="text-zen-black/40 text-sm mb-6">Sign in to see your saved trips</p>
          <button
            onClick={() => signIn(undefined, { callbackUrl: '/my-trip' })}
            className="px-8 py-4 bg-basel-brick text-white font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black transition-all"
          >
            Sign in
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-10">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white p-4 rounded-xl animate-pulse">
              <div className="aspect-[4/5] bg-zen-black/5 rounded-lg mb-6" />
              <div className="h-4 bg-zen-black/10 rounded mb-2" />
              <div className="h-3 bg-zen-black/5 rounded w-2/3" />
            </div>
          ))}
        </div>
      )}

      {/* Trip grid */}
      {isSignedIn && !loading && (
        <>
          {trips.length === 0 ? (
            <div className="border-2 border-dashed border-zen-black/10 rounded-xl p-8 sm:p-16 text-center">
              <p className="text-zen-black/40 font-sans text-lg mb-2">ยังไม่มีแผนการเดินทาง</p>
              <p className="text-zen-black/30 font-sans text-sm mb-6">
                สร้างแผนได้จาก <Link href="/discover" className="text-basel-brick underline">แพลนพร้อมเที่ยว</Link>&nbsp;,&nbsp;&nbsp;หากมีแผนอยู่แล้วอัปโหลดที่นี่เลย <Link href="/ai-scanner" className="text-basel-brick underline">AI Scanner</Link>
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-10">
              <AnimatePresence mode="popLayout">
                {trips.map((trip, idx) => {
                  const itin = trip.itinerary as Itinerary | null
                  // Seed the fallback with the source template so a duplicated trip
                  // shows the SAME cover as the pre-planned trip it came from.
                  const imgSrc = resolveCoverImage(trip.coverImage, trip.templateId ?? trip.id)
                  const tripTotalDays = itin?.totalDays ?? trip.totalDays ?? null
                  return (
                    <motion.div
                      key={trip.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.85, y: -30, filter: 'blur(8px)', transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } }}
                      whileHover={{ y: -10 }}
                      transition={{ layout: { duration: 0.45, ease: [0.4, 0, 0.2, 1] } }}
                      className="group flex flex-col bg-white p-4 rounded-xl shadow-sm hover:shadow-2xl transition-shadow duration-300 relative cursor-pointer"
                      onClick={() => setViewingTripId(trip.id)}
                    >
                      {!trip.locked && (
                        <Link
                          href={`/trips/${trip.id}/edit`}
                          onClick={(e) => e.stopPropagation()}
                          className="absolute top-6 left-6 z-10 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-white/80 rounded-full hover:bg-basel-brick hover:text-white text-zen-black/40"
                          aria-label="แก้ไขแผน"
                        >
                          <Pencil size={14} />
                        </Link>
                      )}
                      {!trip.locked && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(trip.id) }}
                          className="absolute top-6 right-6 z-10 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-white/80 rounded-full hover:bg-basel-brick hover:text-white text-zen-black/40"
                          aria-label="ลบแผน"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      {trip.locked && (
                        <div className="absolute top-6 right-6 z-10 flex items-center gap-1 px-2 py-1 bg-basel-brick text-white shadow-md">
                          <Shield size={10} strokeWidth={3} />
                          <span className="text-[8px] font-black uppercase tracking-widest">Published</span>
                        </div>
                      )}

                      <div className="relative aspect-[4/5] overflow-hidden mb-6 bg-briefing-cream rounded-lg">
                        <Image src={imgSrc} alt={trip.title} fill className="object-cover transition-all duration-700 group-hover:scale-105" sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw" />
                        <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-zen-black/80 to-transparent">
                          <span className="bg-basel-brick text-briefing-cream px-3 py-1 text-[10px] font-black uppercase tracking-widest font-headline">
                            {tripTotalDays ?? '?'} DAYS
                          </span>
                        </div>
                      </div>

                      <h3 className="text-2xl font-headline font-bold text-zen-black mb-2">{trip.title}</h3>
                      {trip.startDate && tripTotalDays ? (
                        <p className="text-xs text-basel-brick font-bold mb-1">{formatDateRange(trip.startDate, tripTotalDays)}</p>
                      ) : null}
                      <p className="text-zen-black/60 text-sm font-sans leading-relaxed mb-1">
                        {itin?.season ?? ''}{itin?.season && tripTotalDays ? ' · ' : ''}{tripTotalDays ? `${tripTotalDays} วัน` : ''}
                      </p>
                      {/* Share code: show code if exists, or generate button */}
                      {trip.shareCode ? (
                        <div className="mb-3">
                          <CodeCopyButton
                            code={trip.shareCode}
                            copied={copiedCode === trip.shareCode}
                            onCopy={(e) => copyCode(trip.shareCode!, e)}
                            size="chip"
                          />
                        </div>
                      ) : (
                        <button
                          onClick={(e) => handleGenerateCode(trip.id, e)}
                          disabled={generatingCode === trip.id}
                          className="w-full mb-3 flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-basel-brick/40 text-basel-brick text-[10px] font-black uppercase tracking-widest hover:bg-basel-brick hover:text-white hover:border-basel-brick transition-all disabled:opacity-50"
                        >
                          {generatingCode === trip.id ? (
                            <><div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> Generating...</>
                          ) : (
                            <><Zap size={12} strokeWidth={2.5} /> Generate LINE code</>
                          )}
                        </button>
                      )}

                      <p className="text-zen-black/30 text-xs font-sans mb-4">
                        {new Date(trip.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                      <button className="mt-auto text-basel-brick font-black text-xs uppercase tracking-widest flex items-center gap-2 group-hover:translate-x-2 transition-transform font-headline">
                        VIEW <ArrowRight size={14} />
                      </button>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          )}
        </>
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zen-black/50 px-4" onClick={(e) => { if (e.target === e.currentTarget) setDeleteConfirm(null) }}>
          <div className="bg-briefing-cream p-8 max-w-sm w-full border border-zen-black/10 shadow-2xl rounded-xl">
            <h3 className="font-headline font-black text-xl text-zen-black mb-3 tracking-tight">ยืนยันการลบ</h3>
            <p className="text-zen-black/60 text-sm font-sans mb-8 leading-relaxed">แผนการเดินทางนี้จะถูกลบถาวร และ LINE Bot จะได้รับแจ้งเตือนโดยอัตโนมัติ</p>
            <div className="flex gap-4">
              <button onClick={() => setDeleteConfirm(null)} disabled={deleting} className="flex-1 py-3 rounded-lg border border-zen-black/20 font-bold text-sm font-headline uppercase tracking-widest hover:bg-zen-black hover:text-briefing-cream transition-all disabled:opacity-40">ยกเลิก</button>
              <button onClick={() => handleDelete(deleteConfirm)} disabled={deleting} className="flex-1 py-3 rounded-lg bg-basel-brick text-white font-bold text-sm font-headline uppercase tracking-widest hover:bg-zen-black transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                {deleting ? (<><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />กำลังลบ...</>) : 'ลบ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trip view modal */}
      <AnimatePresence>
        {viewingTripId && (() => {
          const trip = trips.find((t) => t.id === viewingTripId)
          if (!trip) return null
          const itin = trip.itinerary as Itinerary | null
          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-4 sm:py-10 px-2 sm:px-4" style={{ backgroundColor: 'rgba(35,26,14,0.75)' }} onClick={(e) => { if (e.target === e.currentTarget) setViewingTripId(null) }}>
              <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="w-full max-w-lg bg-briefing-cream border border-zen-black/10 shadow-2xl overflow-hidden rounded-xl">
                <div className="px-4 sm:px-6 pt-3 flex items-center justify-end">
                  <button onClick={() => setViewingTripId(null)} className="text-zen-black/40 hover:text-zen-black text-2xl leading-none transition-colors" aria-label="ปิด">&times;</button>
                </div>
                {itin && itin.days && itin.days.length > 0 && (
                  <div className="px-4 sm:px-6 py-5">
                    <ItineraryView
                      itinerary={itin}
                      variant="light"
                      hero={{
                        image: resolveCoverImage(trip.coverImage, trip.templateId ?? trip.id),
                        title: trip.title,
                        subtitle: trip.startDate && itin.totalDays ? formatDateRange(trip.startDate, itin.totalDays) : `${itin.totalDays ?? itin.days.length} วัน`,
                      }}
                      onMakeDayFree={() => setMakeFreeTripId(trip.id)}
                      makeDayFreeLabel={hasTrailingFreeDay(itin as unknown as AnyItinerary) ? 'เลื่อนแผนลง · ใส่วันอิสระ' : 'ทำให้วันแรกเป็นวันอิสระ'}
                    />
                  </div>
                )}
                <div className="px-4 sm:px-6 py-4 border-t border-zen-black/10 space-y-3">
                  {(itin?.shareCode || trip.shareCode) && (
                    <CodeCopyButton
                      code={(itin?.shareCode ?? trip.shareCode)!}
                      copied={copiedCode === (itin?.shareCode ?? trip.shareCode)}
                      onCopy={() => copyCode((itin?.shareCode ?? trip.shareCode)!)}
                      size="bar"
                    />
                  )}
                  <button onClick={() => setViewingTripId(null)} className="w-full py-3 rounded-lg border-2 border-zen-black font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black hover:text-briefing-cream transition-all">Close</button>
                </div>
              </motion.div>
            </motion.div>
          )
        })()}
      </AnimatePresence>

      {/* Make-Day-1-free confirm — case-aware (shift vs replace) */}
      {(() => {
        const trip = trips.find((t) => t.id === makeFreeTripId)
        const itin = trip?.itinerary as unknown as AnyItinerary | undefined
        const shift = itin ? hasTrailingFreeDay(itin) : false
        return (
          <ConfirmDialog
            open={!!makeFreeTripId}
            tone={shift ? 'default' : 'danger'}
            title={shift ? 'เลื่อนแผนลง 1 วัน?' : 'ทำให้วันแรกเป็นวันอิสระ?'}
            message={shift
              ? <>วันแรกจะกลายเป็น <b>วันอิสระ (เดินทางถึง)</b> แล้วแผนเดิมเลื่อนลง 1 วัน โดยใช้วันอิสระท้ายทริปที่มีอยู่ — <b>ไม่เสียกิจกรรมใด ๆ</b></>
              : <>ทริปนี้ยาวเท่าแผนพอดี ไม่มีวันว่างให้เลื่อน — แผนกิจกรรม<b>วันแรกจะถูกแทนที่</b>ด้วยวันอิสระ (เสียกิจกรรมวันแรก)</>}
            confirmLabel={shift ? 'เลื่อนแผน' : 'ทำให้เป็นวันอิสระ'}
            onConfirm={() => { if (makeFreeTripId) handleMakeDayFree(makeFreeTripId); setMakeFreeTripId(null) }}
            onCancel={() => setMakeFreeTripId(null)}
          />
        )
      })()}
    </main>
  )
}

// ── Copy-to-clipboard button ────────────────────────────────────────────────
// Shows the share code with a copy affordance; on copy the whole button swaps to
// a centered "คัดลอก /activate <code> แล้ว" confirmation (so the user sees the
// exact command on their clipboard), then reverts after ~1.8s. `chip` = compact
// card variant, `bar` = roomier view-modal variant.
function CodeCopyButton({
  code,
  copied,
  onCopy,
  size,
}: {
  code: string
  copied: boolean
  onCopy: (e?: React.MouseEvent) => void
  size: 'chip' | 'bar'
}) {
  const bar = size === 'bar'
  return (
    <button
      onClick={onCopy}
      title="คัดลอกคำสั่ง /activate"
      className={`w-full flex items-center justify-between gap-2 bg-zen-black text-white hover:bg-basel-brick transition-colors group/code ${
        bar ? 'min-h-[3.5rem] px-4 py-3 rounded-lg' : 'min-h-[2.75rem] px-3 py-2'
      }`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="copied"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            className={`w-full flex items-center justify-center gap-1.5 font-bold text-emerald-300 whitespace-nowrap ${
              bar ? 'text-[21px]' : 'text-[12px]'
            }`}
          >
            <Check size={bar ? 15 : 12} strokeWidth={3} />
            คัดลอก <span className="font-mono">/activate {code}</span> แล้ว
          </motion.span>
        ) : (
          <motion.span
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full flex items-center justify-between gap-2"
          >
            <span className="flex flex-col items-start leading-tight">
              <span className={`font-black uppercase tracking-[0.3em] text-white/50 ${bar ? 'text-[8px]' : 'text-[7px]'}`}>
                {bar ? 'LINE Share Code' : 'LINE Code'}
              </span>
              <span className={`font-mono font-bold ${bar ? 'text-lg' : 'text-sm'}`}>{code}</span>
            </span>
            {bar ? (
              <span className="text-[9px] border border-white/30 px-2 py-1 font-bold uppercase flex items-center gap-1">
                <Copy size={11} /> Copy
              </span>
            ) : (
              <Copy size={12} className="text-white/60 group-hover/code:text-white" />
            )}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  )
}

