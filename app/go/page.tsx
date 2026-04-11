'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Trash2, ArrowRight, Shield, ChevronDown, MapPin, Hotel, Train, Clock, Banknote, Timer, Plane, Zap, Copy } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { useSession, signIn } from 'next-auth/react'
import { IMG } from '@/lib/images'
import { resolveCoverImage } from '@/lib/cover-image'
import { PRIORITY_LABEL } from '@/lib/itinerary-types'
import type { Itinerary, Activity, Day, Choice, ActivityPriority } from '@/lib/itinerary-types'
import CategoryIcon from '@/app/components/CategoryIcon'
import ChoiceCarousel from '@/app/components/ChoiceCarousel'

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
  const [generatingCode, setGeneratingCode] = useState<string | null>(null)

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
    <main className="pt-32 pb-24 px-6 max-w-7xl mx-auto">
      {/* Hero */}
      <header className="mb-20">
        <h1 className="text-4xl md:text-5xl lg:text-7xl font-headline font-extrabold tracking-tighter text-basel-brick mb-6">
          Go!
        </h1>
        <p className="text-zen-black/70 text-lg max-w-3xl leading-relaxed font-sans">
          แผนการเดินทางที่พร้อมออกเดินทาง ใช้ share code เพื่อ activate บน LINE แล้วออกไปเที่ยวได้เลย
        </p>
        <p className="text-zen-black/40 text-sm mt-1 font-sans">
          Your trips, ready to travel. Activate on LINE and go!
        </p>
      </header>

      {/* Sign-in CTA for guests */}
      {!isSignedIn && !loading && (
        <div className="border-2 border-dashed border-zen-black/10 rounded-xl p-16 text-center mb-20">
          <Plane size={40} className="mx-auto mb-4 text-zen-black/20" />
          <p className="text-zen-black/60 text-lg mb-2 font-sans">สมัครสมาชิกเพื่อดูแผนการเดินทางของคุณ</p>
          <p className="text-zen-black/40 text-sm mb-6">Sign in to see your saved trips</p>
          <button
            onClick={() => signIn(undefined, { callbackUrl: '/go' })}
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
            <div className="border-2 border-dashed border-zen-black/10 rounded-xl p-16 text-center">
              <p className="text-zen-black/40 font-sans text-lg mb-2">ยังไม่มีแผนการเดินทาง</p>
              <p className="text-zen-black/30 font-sans text-sm mb-6">
                สร้างแผนได้จาก <Link href="/templates" className="text-basel-brick underline">Templates</Link>&nbsp;,&nbsp;&nbsp;หากมีแผนอยู่แล้วอัปโหลดที่นี่เลย <Link href="/gallery" className="text-basel-brick underline">Doc-to-Trip</Link>
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-10">
              <AnimatePresence mode="popLayout">
                {trips.map((trip, idx) => {
                  const itin = trip.itinerary as Itinerary | null
                  const imgSrc = resolveCoverImage(trip.coverImage, trip.id)
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
                      className="group flex flex-col bg-white p-4 rounded-xl shadow-sm hover:shadow-2xl transition-all duration-300 relative cursor-pointer"
                      onClick={() => setViewingTripId(trip.id)}
                    >
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigator.clipboard.writeText(`/activate ${trip.shareCode}`)
                          }}
                          className="w-full mb-3 flex items-center justify-between gap-2 px-3 py-2 bg-zen-black text-white hover:bg-basel-brick transition-colors group/code"
                        >
                          <div className="flex flex-col items-start leading-tight">
                            <span className="text-[7px] font-black uppercase tracking-[0.3em] text-white/50">LINE Code</span>
                            <span className="font-mono text-sm font-bold">{trip.shareCode}</span>
                          </div>
                          <Copy size={12} className="text-white/60 group-hover/code:text-white" />
                        </button>
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
          <div className="bg-briefing-cream p-8 max-w-sm w-full border border-zen-black/10 shadow-2xl">
            <h3 className="font-headline font-black text-xl text-zen-black mb-3 tracking-tight">ยืนยันการลบ</h3>
            <p className="text-zen-black/60 text-sm font-sans mb-8 leading-relaxed">แผนการเดินทางนี้จะถูกลบถาวร และ LINE Bot จะได้รับแจ้งเตือนโดยอัตโนมัติ</p>
            <div className="flex gap-4">
              <button onClick={() => setDeleteConfirm(null)} disabled={deleting} className="flex-1 py-3 border border-zen-black/20 font-bold text-sm font-headline uppercase tracking-widest hover:bg-zen-black hover:text-briefing-cream transition-all disabled:opacity-40">ยกเลิก</button>
              <button onClick={() => handleDelete(deleteConfirm)} disabled={deleting} className="flex-1 py-3 bg-basel-brick text-white font-bold text-sm font-headline uppercase tracking-widest hover:bg-zen-black transition-all disabled:opacity-60 flex items-center justify-center gap-2">
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
              <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="w-full max-w-lg bg-briefing-cream border border-zen-black/10 shadow-2xl overflow-hidden">
                <div className="px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between border-b border-zen-black/10">
                  <div className="min-w-0 flex-1 mr-3">
                    <h2 className="font-headline font-black text-lg sm:text-xl tracking-tighter text-zen-black truncate">{trip.title}</h2>
                    {trip.startDate && itin?.totalDays ? <p className="text-xs text-basel-brick font-bold mt-1">{formatDateRange(trip.startDate, itin.totalDays)}</p> : null}
                  </div>
                  <button onClick={() => setViewingTripId(null)} className="text-zen-black/40 hover:text-zen-black text-2xl leading-none transition-colors" aria-label="ปิด">&times;</button>
                </div>
                {(itin?.shareCode || trip.shareCode) && (
                  <div className="px-4 sm:px-6 py-3 bg-zen-black flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[8px] font-black uppercase tracking-[0.4em] text-white/50 block">LINE Share Code</span>
                      <span className="font-mono text-lg font-bold text-white">{itin?.shareCode ?? trip.shareCode}</span>
                    </div>
                    <button onClick={() => navigator.clipboard.writeText(`/activate ${itin?.shareCode ?? trip.shareCode}`)} className="text-[9px] border border-white/30 text-white px-3 py-1.5 font-bold uppercase hover:bg-white hover:text-zen-black transition-all">Copy</button>
                  </div>
                )}
                {itin && itin.days && itin.days.length > 0 && <GoTripAccordion itinerary={itin} />}
                <div className="px-4 sm:px-6 py-4 border-t border-zen-black/10">
                  <button onClick={() => setViewingTripId(null)} className="w-full py-3 border-2 border-zen-black font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black hover:text-briefing-cream transition-all">Close</button>
                </div>
              </motion.div>
            </motion.div>
          )
        })()}
      </AnimatePresence>
    </main>
  )
}

// ── Read-only itinerary accordion ───────────────────────────────────────────

function GoTripAccordion({ itinerary }: { itinerary: Itinerary }) {
  const [openDay, setOpenDay] = useState<number | null>(1)
  const totalDays = itinerary.totalDays ?? itinerary.days.length
  const currentOpenDay = openDay ?? 1

  return (
    <div>
      <div className="flex items-baseline justify-between px-4 sm:px-6 py-4 border-b border-zen-black/5">
        <h3 className="font-headline text-lg font-extrabold text-zen-black">The Journey</h3>
        <span className="text-[10px] font-bold text-basel-brick uppercase tracking-widest">Day {currentOpenDay} / {totalDays}</span>
      </div>
      <div className="divide-y divide-zen-black/5">
        {itinerary.days.map((day) => {
          const isOpen = openDay === day.day
          const paddedDay = String(day.day).padStart(2, '0')
          const mandatoryCount = day.activities.filter((a) => a.priority === 'mandatory').length
          return (
            <div key={day.day}>
              <button className="w-full text-left px-4 sm:px-6 py-4 flex items-center gap-3 sm:gap-4 hover:bg-briefing-cream/50 transition-colors" onClick={() => setOpenDay(isOpen ? null : day.day)}>
                <span className={`inline-flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-xl font-black text-sm sm:text-lg flex-shrink-0 transition-colors ${isOpen ? 'bg-basel-brick text-white' : 'bg-zen-black/5 text-zen-black/40'}`}>{paddedDay}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base sm:text-lg text-zen-black leading-tight truncate">{day.location}</p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                    <span className="text-[10px] sm:text-xs text-zen-black/40 font-medium flex items-center gap-1"><MapPin size={10} strokeWidth={2.5} /> Day {day.day} · {day.activities.length} กิจกรรม</span>
                    {mandatoryCount > 0 && <span className="text-[10px] text-basel-brick font-medium">⚠ {mandatoryCount} must-do</span>}
                    {(day.choices?.length ?? 0) > 0 && <span className="text-[10px] text-blue-600 font-medium">★ {day.choices!.length} choice{day.choices!.length > 1 ? 's' : ''}</span>}
                  </div>
                </div>
                <ChevronDown size={18} className={`flex-shrink-0 transition-all duration-200 ${isOpen ? 'rotate-180 text-basel-brick' : 'rotate-0 text-zen-black/20'}`} />
              </button>
              {isOpen && (
                <div className="px-4 sm:px-6 pb-6 pt-2 space-y-6 border-t border-zen-black/5 bg-briefing-cream/30">
                  {day.activities.length > 0 && (
                    <div className="space-y-5">
                      {day.activities.map((act, idx) => {
                        const p = act.priority ?? 'optional'
                        const borderColor = p === 'mandatory' ? 'border-red-500' : p === 'recommended' ? 'border-amber-400' : 'border-basel-brick'
                        const dotColor = p === 'mandatory' ? 'bg-red-500' : p === 'recommended' ? 'bg-amber-400' : 'bg-basel-brick'
                        return (
                          <div key={idx} className={`relative pl-7 border-l-[3px] ${borderColor}`}>
                            <span className={`absolute -left-[6px] top-0.5 w-2.5 h-2.5 rounded-full ${dotColor}`} />
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-[10px] font-bold text-basel-brick uppercase tracking-widest flex items-center gap-1"><Clock size={10} strokeWidth={2.5} /> {act.time}</p>
                              {p === 'mandatory' && <span className="text-[8px] font-black uppercase tracking-widest bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{PRIORITY_LABEL.mandatory}</span>}
                              {p === 'recommended' && <span className="text-[8px] font-black uppercase tracking-widest bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">{PRIORITY_LABEL.recommended}</span>}
                              {act.category && <CategoryIcon category={act.category} size={12} className="text-zen-black/50" />}
                            </div>
                            <p className="font-bold text-base text-zen-black mt-1">{act.name}</p>
                            {act.notes && <p className="text-sm text-zen-black/60 mt-1.5 leading-relaxed">{act.notes}</p>}
                            {(act.cost || act.duration) && (
                              <div className="flex gap-3 mt-1.5">
                                {act.cost && <span className="text-[10px] font-bold text-zen-black/50 flex items-center gap-0.5"><Banknote size={10} strokeWidth={2} /> {act.cost}</span>}
                                {act.duration && <span className="text-[10px] font-bold text-zen-black/50 flex items-center gap-0.5"><Timer size={10} strokeWidth={2} /> {act.duration}</span>}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {day.choices && day.choices.length > 0 && (
                    <div className="space-y-4">{day.choices.map((choice, idx) => <ChoiceCarousel key={idx} choice={choice} />)}</div>
                  )}
                  {day.accommodation && (
                    <div className="flex items-start gap-2">
                      <Hotel size={14} className="text-basel-brick flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                      <div><p className="text-[10px] font-bold text-basel-brick uppercase tracking-widest mb-1">ที่พัก</p><p className="text-sm text-zen-black leading-relaxed">{day.accommodation}</p></div>
                    </div>
                  )}
                  {day.transport && (
                    <div className="flex items-start gap-2">
                      <Train size={14} className="text-basel-brick flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                      <div>
                        <p className="text-[10px] font-bold text-basel-brick uppercase tracking-widest mb-1">การเดินทาง</p>
                        <p className="text-sm text-zen-black leading-relaxed">{day.transport}</p>
                        {day.transportNotes && <p className="text-xs text-zen-black/50 mt-1 italic">{day.transportNotes}</p>}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
