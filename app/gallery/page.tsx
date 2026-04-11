'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { CloudUpload, CheckCircle, Trash2, ArrowRight, Flower, Lock, Shield, ChevronDown, MapPin, Hotel, Train, Clock } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import { useSession, signIn } from 'next-auth/react'
import ItineraryCard from '@/app/components/ItineraryCard'
import ActivationBanner from '@/app/components/ActivationBanner'
import CoverUpload from '@/app/components/CoverUpload'
import { IMG } from '@/lib/images'
import { resolveCoverImage } from '@/lib/cover-image'

// ── Types ────────────────────────────────────────────────────────────────────

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
  title: string
  totalDays: number
  season: string
  days: Day[]
  shareCode: string | null
}

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
  /** True if this trip has been promoted to a published Template and cannot be deleted */
  locked?: boolean
}

type UploadState = 'idle' | 'uploading' | 'review' | 'saving' | 'done'

// ── Stock image pool (reused from Home) ──────────────────────────────────────

const STOCK_IMAGES = [IMG.stock1, IMG.stock2, IMG.stock3, IMG.stock4]

// ── Gallery page ─────────────────────────────────────────────────────────────

export default function GalleryPage() {
  const { data: session, status: sessionStatus } = useSession()
  const isSignedIn = !!session?.user
  // Upload state
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [isDragging, setIsDragging] = useState(false)
  const [uploadedItinerary, setUploadedItinerary] = useState<Itinerary | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadShareCode, setUploadShareCode] = useState<string | null>(null)
  const [uploadStartDate, setUploadStartDate] = useState('')
  const [uploadCoverImage, setUploadCoverImage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Saved trips state
  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>([])
  const [tripsLoading, setTripsLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [viewingTripId, setViewingTripId] = useState<string | null>(null)

  // ── Load saved trips on mount (guests get empty array from the API) ───────
  useEffect(() => {
    if (sessionStatus === 'loading') return
    if (!isSignedIn) {
      setSavedTrips([])
      setTripsLoading(false)
      return
    }
    async function loadTrips() {
      try {
        const res = await fetch('/api/trips')
        if (!res.ok) throw new Error('Failed to load')
        const data = await res.json()
        setSavedTrips(data.trips ?? [])
      } catch {
        // silently fail
      } finally {
        setTripsLoading(false)
      }
    }
    loadTrips()
  }, [isSignedIn, sessionStatus])

  // ── Upload handlers ────────────────────────────────────────────────────────

  async function processFile(file: File) {
    // Guest gate — AI file extraction is member-only (VLM is expensive).
    if (!isSignedIn) {
      signIn(undefined, { callbackUrl: '/gallery' })
      return
    }

    const allowedMime = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ]
    const allowedExt = /\.(pdf|png|jpe?g|webp|xlsx|xls)$/i
    if (!allowedMime.includes(file.type) && !allowedExt.test(file.name)) {
      setUploadError('รองรับเฉพาะไฟล์ PDF, รูปภาพ (PNG/JPG/WebP), หรือ Excel (.xlsx/.xls)')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('ไฟล์ใหญ่เกิน 10 MB')
      return
    }

    setUploadError(null)
    setUploadState('uploading')

    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'อัปโหลดไม่สำเร็จ')
      setUploadedItinerary(body.itinerary)
      setUploadState('review')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
      setUploadError(message)
      setUploadState('idle')
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  // processFile is stable within the component render cycle
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  async function handleUploadConfirm() {
    if (!uploadedItinerary) return
    setUploadState('saving')

    try {
      const saveRes = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: uploadedItinerary.title,
          itinerary: uploadedItinerary,
          source: 'upload',
          startDate: uploadStartDate || undefined,
          coverImage: uploadCoverImage || undefined,
        }),
      })
      if (!saveRes.ok) throw new Error('บันทึกไม่สำเร็จ')
      const { trip } = await saveRes.json()

      const primaryCity = uploadedItinerary.days[0]?.location ?? 'JPN'
      const activateRes = await fetch('/api/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId: trip.id, primaryCity }),
      })
      if (!activateRes.ok) throw new Error('สร้างรหัสไม่สำเร็จ')
      const { shareCode } = await activateRes.json()

      setUploadShareCode(shareCode)
      setUploadState('done')

      // Refresh saved trips list — include the cover image so the new card
      // renders with the user's uploaded image immediately, no page refresh.
      setSavedTrips((prev) => [
        {
          id: trip.id,
          title: trip.title,
          createdAt: trip.createdAt,
          itinerary: uploadedItinerary,
          source: 'upload',
          coverImage: uploadCoverImage,
          startDate: uploadStartDate || null,
        },
        ...prev,
      ])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
      setUploadError(message)
      setUploadState('review')
    }
  }

  function handleReUpload() {
    setUploadedItinerary(null)
    setUploadShareCode(null)
    setUploadError(null)
    setUploadStartDate('')
    setUploadCoverImage(null)
    setUploadState('idle')
  }

  // ── Delete handler ─────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    setDeleting(true)
    try {
      const res = await fetch(`/api/trips/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        // Special-case the 409 Conflict thrown when a trip has been promoted
        // to a published template and is now locked. Show a dedicated
        // dialog pointing to /support instead of the generic delete error.
        if (res.status === 409) {
          setDeleteConfirm(null)
          alert(
            (body.error as string) ??
              'ทริปนี้ถูกเผยแพร่เป็นเทมเพลต ไม่สามารถลบได้ กรุณาติดต่อแอดมินผ่าน /support'
          )
          return
        }
        throw new Error(body.error ?? 'ลบไม่สำเร็จ')
      }
      // Close the dialog first, then remove the trip so the AnimatePresence
      // exit animation plays on an unobscured card.
      setDeleteConfirm(null)
      setSavedTrips((prev) => prev.filter((t) => t.id !== id))
    } catch {
      alert('ไม่สามารถลบแผนได้ กรุณาลองใหม่')
      setDeleteConfirm(null)
    } finally {
      setDeleting(false)
    }
  }

  // ── Date range helper ──────────────────────────────────────────────────────

  function formatDateRange(startDateStr: string, days: number): string {
    const start = new Date(startDateStr)
    const end = new Date(startDateStr)
    end.setDate(end.getDate() + days - 1)
    const fmt = (d: Date) => d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
    return `${fmt(start)} - ${fmt(end)}`
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="pt-32 pb-24 px-6 max-w-7xl mx-auto">
      {/* Hero */}
      <header className="mb-20">
        <h1 className="text-4xl md:text-5xl lg:text-7xl font-headline font-extrabold tracking-tighter text-basel-brick mb-6">The Digital Curator</h1>
        <p className="text-zen-black/70 text-lg max-w-2xl leading-relaxed font-sans">
          อัปโหลดแผนเดิม หรือดูแผนที่บันทึกไว้ของคุณ ทุกการเดินทางจะเป็นไปอย่างราบรื่น
        </p>
      </header>

      {/* Upload Section */}
      <section className="mb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left info card */}
          <div className="lg:col-span-4 bg-basel-brick text-briefing-cream p-12 flex flex-col justify-between">
            <div>
              <h2 className="text-3xl font-headline font-bold mb-6 leading-tight">Digitize Your Plans</h2>
              <p className="text-briefing-cream/80 leading-relaxed font-sans">
                เปลี่ยนแผนเที่ยวธรรมดาให้มีชีวิต! <br />แค่อัปโหลดแพลนของคุณ, dopamichi จะแปลงข้อมูลทั้งหมดให้กลายเป็น Chatbot <br />คู่หูส่วนตัวที่รู้ทุกตารางเวลาและพร้อมตอบทุกคำถามตลอดทริป
              </p>
            </div>
            <div className="mt-12 space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="text-briefing-cream w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-widest font-headline">Instant Sync</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="text-briefing-cream w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-widest font-headline">AI Extraction</span>
              </div>
            </div>
          </div>

          {/* Right upload zone */}
          <div className="lg:col-span-8">
            {uploadError && (
              <div className="mb-4 px-4 py-3 border-l-4 border-basel-brick bg-red-50 text-red-800 text-sm font-medium">
                {uploadError}
              </div>
            )}

            {(uploadState === 'idle' || uploadState === 'uploading') && !isSignedIn && (
              <div className="bg-zen-black border-[12px] border-zen-black flex items-center justify-center min-h-[450px]">
                <div className="bg-white w-full h-full flex flex-col items-center justify-center p-12 border-2 border-dashed border-zen-black/10 text-center">
                  <div className="w-24 h-24 bg-basel-brick rounded-full flex items-center justify-center mb-8 shadow-xl">
                    <Lock className="text-briefing-cream w-10 h-10" strokeWidth={2} />
                  </div>
                  <h3 className="text-2xl font-headline font-bold text-zen-black mb-3 tracking-tight">
                    Sign up to upload
                  </h3>
                  <p className="text-zen-black/60 font-sans text-sm mb-3 max-w-md leading-relaxed">
                    สมัครสมาชิกฟรีเพื่อใช้ฟีเจอร์ AI อ่านไฟล์และบันทึกทริปของคุณ
                  </p>
                  <p className="text-zen-black/40 font-sans text-xs mb-10 max-w-md">
                    Create a free account to use AI file extraction and save your trips.
                  </p>
                  <button
                    onClick={() => signIn(undefined, { callbackUrl: '/gallery' })}
                    className="bg-basel-brick text-briefing-cream px-10 py-5 font-bold tracking-tight hover:bg-zen-black transition-colors duration-300 font-headline uppercase"
                  >
                    Sign up / Sign in
                  </button>
                </div>
              </div>
            )}

            {(uploadState === 'idle' || uploadState === 'uploading') && isSignedIn && (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={[
                  'bg-zen-black border-[12px] flex items-center justify-center min-h-[450px] group cursor-pointer transition-colors duration-500',
                  isDragging ? 'border-basel-brick' : 'border-zen-black hover:border-basel-brick',
                ].join(' ')}
              >
                <div className="bg-white w-full h-full flex flex-col items-center justify-center p-12 border-2 border-dashed border-zen-black/10">
                  {uploadState === 'uploading' ? (
                    <>
                      <div className="w-24 h-24 bg-basel-brick rounded-full flex items-center justify-center mb-8 shadow-xl">
                        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
                      </div>
                      <h3 className="text-2xl font-headline font-bold text-zen-black mb-3 tracking-tight">กำลังวิเคราะห์...</h3>
                      <p className="text-zen-black/50 font-sans text-sm uppercase tracking-widest font-bold">AI กำลังอ่านและแปลงข้อมูล</p>
                    </>
                  ) : (
                    <>
                      <div className="w-24 h-24 bg-basel-brick rounded-full flex items-center justify-center mb-8 shadow-xl">
                        <CloudUpload className="text-briefing-cream w-12 h-12" />
                      </div>
                      <h3 className="text-2xl font-headline font-bold text-zen-black mb-3 tracking-tight">Drag and drop your itinerary</h3>
                      <p className="text-zen-black/50 font-sans text-sm mb-10 uppercase tracking-widest font-bold">Image (.png, .jpg) / PDF / Excel (.xlsx) up to 10MB each</p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-zen-black text-briefing-cream px-10 py-5 font-bold tracking-tight hover:bg-basel-brick transition-colors duration-300 font-headline"
                      >
                        SELECT FILES FROM DEVICE
                      </button>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={uploadState === 'uploading'}
                  />
                </div>
              </div>
            )}

            {(uploadState === 'review' || uploadState === 'saving' || uploadState === 'done') && uploadedItinerary && (
              <div className="bg-white p-8 border border-zen-black/10">
                {uploadState !== 'done' && (
                  <div className="mb-4 px-4 py-3 border-l-4 border-zen-black/20 bg-zen-black/5 text-zen-black/70 text-sm font-medium">
                    ตรวจสอบแผนการเดินทางที่ AI สกัดออกมา หากถูกต้องให้กดยืนยันและบันทึก
                  </div>
                )}
                {uploadState === 'done' && uploadShareCode ? (
                  <>
                    <ActivationBanner shareCode={uploadShareCode} />
                    <button
                      onClick={handleReUpload}
                      className="mt-4 w-full py-3 font-bold text-sm border border-zen-black/20 text-zen-black/60 hover:bg-zen-black hover:text-briefing-cream transition-all font-headline uppercase tracking-widest"
                    >
                      อัปโหลดไฟล์อื่น
                    </button>
                  </>
                ) : (
                  <>
                    <div className="mb-4">
                      <label className="block text-xs font-bold uppercase tracking-widest text-basel-brick mb-1">
                        วันเริ่มเดินทาง (ไม่ระบุก็ได้)
                      </label>
                      <input
                        type="date"
                        value={uploadStartDate}
                        onChange={(e) => setUploadStartDate(e.target.value)}
                        disabled={uploadState === 'saving'}
                        className="w-full bg-briefing-cream border border-zen-black/20 px-4 py-3 font-medium text-sm text-zen-black focus:outline-none focus:border-basel-brick transition-colors disabled:opacity-40"
                      />
                    </div>

                    {/* Optional cover image */}
                    <div className="mb-4">
                      <label className="block text-xs font-bold uppercase tracking-widest text-basel-brick mb-2">
                        รูปหน้าปก (ไม่ระบุก็ได้) · Cover image (optional)
                      </label>
                      <CoverUpload
                        value={uploadCoverImage}
                        onChange={setUploadCoverImage}
                        disabled={uploadState === 'saving'}
                      />
                    </div>

                    <ItineraryCard
                      itinerary={uploadedItinerary}
                      onConfirm={handleUploadConfirm}
                      confirmLoading={uploadState === 'saving'}
                    />
                    <button
                      onClick={handleReUpload}
                      disabled={uploadState === 'saving'}
                      className="mt-3 w-full py-3 font-bold text-sm border border-zen-black/20 text-zen-black/60 hover:bg-zen-black hover:text-briefing-cream transition-all disabled:opacity-40 font-headline uppercase tracking-widest"
                    >
                      อัปโหลดไฟล์ใหม่
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Saved Trips Section */}
      <section className="mb-24">
        <div className="flex flex-col md:flex-row justify-between md:items-end mb-16 gap-4 md:gap-6 border-b-2 border-zen-black/5 pb-8">
          <div>
            <span className="text-basel-brick font-extrabold text-sm uppercase tracking-[0.3em] mb-4 block font-headline">Your Collection</span>
            <h2 className="text-3xl md:text-5xl font-headline font-black tracking-tighter text-zen-black">แผนการเดินทางของคุณ</h2>
            <p className="text-zen-black/50 text-sm mt-2 font-sans">Saved Journeys</p>
          </div>
        </div>

        {tripsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-10">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white p-4 rounded-xl animate-pulse">
                <div className="aspect-[4/5] bg-zen-black/5 rounded-lg mb-6" />
                <div className="h-4 bg-zen-black/10 rounded mb-2" />
                <div className="h-3 bg-zen-black/5 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : (() => {
          // "My Uploads" = anything the user created that is NOT a hearted
          // template. Saved templates live in a separate section below.
          const visible = savedTrips.filter((t) => t.source !== 'template')
          if (visible.length === 0) {
            return (
              <div className="border-2 border-dashed border-zen-black/10 rounded-xl p-16 text-center">
                <p className="text-zen-black/40 font-sans text-lg mb-2">ยังไม่มีแผนที่อัปโหลดหรือสร้างไว้</p>
                <p className="text-zen-black/30 font-sans text-sm">เริ่มต้นที่ AI Chat หรืออัปโหลดด้านบน</p>
              </div>
            )
          }
          return (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-10">
              <AnimatePresence mode="popLayout">
              {visible.map((trip) => {
                const itin = trip.itinerary as Itinerary | null
                // User's chosen cover if set, otherwise deterministic fallback
                // from the trip id (stable per-trip, not position-based)
                const imgSrc = resolveCoverImage(trip.coverImage, trip.id)
                const tripTotalDays = itin?.totalDays ?? trip.totalDays ?? null
                return (
                  <motion.div
                    key={trip.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{
                      opacity: 0,
                      scale: 0.85,
                      y: -30,
                      filter: 'blur(8px)',
                      transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
                    }}
                    whileHover={{ y: -10 }}
                    transition={{ layout: { duration: 0.45, ease: [0.4, 0, 0.2, 1] } }}
                    className="group flex flex-col bg-white p-4 rounded-xl shadow-sm hover:shadow-2xl transition-all duration-300 relative cursor-pointer"
                    onClick={() => setViewingTripId(trip.id)}
                  >
                    {/* Delete button — hidden on locked (promoted-to-template) trips */}
                    {!trip.locked && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm(trip.id) }}
                        className="absolute top-6 right-6 z-10 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-white/80 rounded-full hover:bg-basel-brick hover:text-white text-zen-black/40"
                        aria-label="ลบแผน"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}

                    {/* Lock badge for trips that have been promoted to a curated template */}
                    {trip.locked && (
                      <div
                        className="absolute top-6 right-6 z-10 flex items-center gap-1 px-2 py-1 bg-basel-brick text-white shadow-md"
                        title="ทริปนี้ถูกเผยแพร่เป็นเทมเพลต ติดต่อแอดมินผ่าน /support เพื่อขอลบ"
                      >
                        <Shield size={10} strokeWidth={3} />
                        <span className="text-[8px] font-black uppercase tracking-widest">
                          Published
                        </span>
                      </div>
                    )}

                    <div className="relative aspect-[4/5] overflow-hidden mb-6 bg-briefing-cream rounded-lg">
                      <Image
                        src={imgSrc}
                        alt={trip.title}
                        fill
                        className="object-cover transition-all duration-700 group-hover:scale-105"
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      />
                      <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-zen-black/80 to-transparent">
                        <span className="bg-basel-brick text-briefing-cream px-3 py-1 text-[10px] font-black uppercase tracking-widest font-headline">
                          {tripTotalDays ?? '?'} DAYS
                        </span>
                      </div>
                    </div>

                    <h3 className="text-2xl font-headline font-bold text-zen-black mb-2">{trip.title}</h3>
                    {trip.startDate && tripTotalDays ? (
                      <p className="text-xs text-basel-brick font-bold mb-1">
                        {formatDateRange(trip.startDate, tripTotalDays)}
                      </p>
                    ) : null}
                    <p className="text-zen-black/60 text-sm font-sans leading-relaxed mb-1">
                      {itin?.season ?? ''}{itin?.season && tripTotalDays ? ' · ' : ''}{tripTotalDays ? `${tripTotalDays} วัน` : ''}
                    </p>
                    {itin?.shareCode && (
                      <p className="text-[10px] font-black uppercase tracking-widest text-basel-brick font-headline mb-2">
                        Code: {itin.shareCode}
                      </p>
                    )}
                    <p className="text-zen-black/30 text-xs font-sans mb-4">
                      {new Date(trip.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                    <button
                      className="mt-auto text-basel-brick font-black text-xs uppercase tracking-widest flex items-center gap-2 group-hover:translate-x-2 transition-transform font-headline"
                    >
                      VIEW <ArrowRight size={14} />
                    </button>
                  </motion.div>
                )
              })}
              </AnimatePresence>
            </div>
          )
        })()}
      </section>

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zen-black/50 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteConfirm(null) }}
        >
          <div className="bg-briefing-cream p-8 max-w-sm w-full border border-zen-black/10 shadow-2xl">
            <h3 className="font-headline font-black text-xl text-zen-black mb-3 tracking-tight">ยืนยันการลบ</h3>
            <p className="text-zen-black/60 text-sm font-sans mb-8 leading-relaxed">
              แผนการเดินทางนี้จะถูกลบถาวร และ LINE Bot จะได้รับแจ้งเตือนโดยอัตโนมัติ
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="flex-1 py-3 border border-zen-black/20 font-bold text-sm font-headline uppercase tracking-widest hover:bg-zen-black hover:text-briefing-cream transition-all disabled:opacity-40"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
                className="flex-1 py-3 bg-basel-brick text-white font-bold text-sm font-headline uppercase tracking-widest hover:bg-zen-black transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    กำลังลบ...
                  </>
                ) : (
                  'ลบ'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trip view modal — shows full itinerary + share code when user clicks a card */}
      <AnimatePresence>
        {viewingTripId && (() => {
          const trip = savedTrips.find((t) => t.id === viewingTripId)
          if (!trip) return null
          const itin = trip.itinerary as Itinerary | null
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10 px-4"
              style={{ backgroundColor: 'rgba(35,26,14,0.75)' }}
              onClick={(e) => {
                if (e.target === e.currentTarget) setViewingTripId(null)
              }}
            >
              <motion.div
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 40, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="w-full max-w-lg bg-briefing-cream border border-zen-black/10 shadow-2xl overflow-hidden"
              >
                {/* Modal header */}
                <div className="px-6 py-5 flex items-center justify-between border-b border-zen-black/10">
                  <div>
                    <h2 className="font-headline font-black text-xl tracking-tighter text-zen-black">
                      {trip.title}
                    </h2>
                    {trip.startDate && itin?.totalDays ? (
                      <p className="text-xs text-basel-brick font-bold mt-1">
                        {formatDateRange(trip.startDate, itin.totalDays)}
                      </p>
                    ) : null}
                  </div>
                  <button
                    onClick={() => setViewingTripId(null)}
                    className="text-zen-black/40 hover:text-zen-black text-2xl leading-none transition-colors"
                    aria-label="ปิด"
                  >
                    &times;
                  </button>
                </div>

                {/* Share code banner */}
                {(itin?.shareCode || trip.shareCode) && (
                  <div className="px-6 py-3 bg-zen-black flex items-center justify-between">
                    <div>
                      <span className="text-[8px] font-black uppercase tracking-[0.4em] text-white/50 block">
                        LINE Share Code
                      </span>
                      <span className="font-mono text-lg font-bold text-white">
                        {itin?.shareCode ?? trip.shareCode}
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(
                          `/activate ${itin?.shareCode ?? trip.shareCode}`
                        )
                      }
                      className="text-[9px] border border-white/30 text-white px-3 py-1.5 font-bold uppercase hover:bg-white hover:text-zen-black transition-all"
                    >
                      Copy
                    </button>
                  </div>
                )}

                {/* Itinerary content — reuses the white-themed ItineraryCard structure
                    but without the confirm button (read-only view) */}
                {itin && itin.days && itin.days.length > 0 && (
                  <TripViewAccordion itinerary={itin} />
                )}

                {/* Close button */}
                <div className="px-6 py-4 border-t border-zen-black/10">
                  <button
                    onClick={() => setViewingTripId(null)}
                    className="w-full py-3 border-2 border-zen-black font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black hover:text-briefing-cream transition-all"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )
        })()}
      </AnimatePresence>

      {/* Decorative Maintenance Section */}
      <section className="border-t border-zen-black/10 pt-24">
        <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 gap-16 items-center mx-auto">
          {/* Visual */}
          <div className="relative flex justify-center items-center">
            <div className="absolute inset-0 bg-basel-brick/5 rounded-full blur-3xl scale-125" />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="relative w-full aspect-square max-w-md bg-white border border-basel-brick/10 rounded-[3rem] overflow-hidden flex items-center justify-center group shadow-2xl shadow-black/5"
            >
              <div className="absolute inset-0 opacity-5 mix-blend-multiply relative">
                <Image
                  src={IMG.logo}
                  alt="background pattern"
                  fill
                  className="object-cover grayscale scale-150 rotate-12"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
              <div className="relative z-10 flex flex-col items-center gap-8">
                <div className="w-40 h-40 flex items-center justify-center bg-white rounded-full shadow-lg border border-basel-brick/5">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <Flower className="text-basel-brick w-24 h-24" strokeWidth={1} fill="currentColor" fillOpacity={0.1} />
                  </motion.div>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="w-12 h-0.5 bg-basel-brick" />
                  <div className="w-24 h-0.5 bg-basel-brick/30" />
                </div>
              </div>
              {/* Status Badge */}
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-zen-black text-briefing-cream px-6 py-2.5 rounded-full flex items-center gap-3">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-basel-brick opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-basel-brick" />
                </span>
                <span className="text-[10px] font-bold tracking-[0.3em] uppercase">Refining Zen</span>
              </div>
            </motion.div>
          </div>

          {/* Content */}
          <div className="space-y-10">
            <div className="space-y-6">
              <div className="inline-block px-3 py-1 bg-basel-brick text-white text-[10px] font-bold tracking-[0.4em] uppercase">
                System Maintenance
              </div>
              <h2 className="font-headline text-5xl md:text-6xl font-extrabold text-zen-black leading-[1.1] tracking-tighter">
                สุนทรียภาพแห่งการพักผ่อน <br />
                <span className="text-basel-brick">เพื่อก้าวที่ไกลกว่า</span>
              </h2>
              <p className="text-zen-black/70 text-xl font-light leading-relaxed max-w-md border-l-2 border-basel-brick pl-6 italic">
                ขออภัยในความไม่สะดวก ขณะนี้ dopamichi กำลังปรับจูนระบบเพื่อความสมบูรณ์แบบสูงสุด โปรดกลับมาสัมผัสประสบการณ์ใหม่ในเร็วๆ นี้
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

// ── Read-only itinerary accordion for the trip view modal ───────────────────
// Mirrors the white-themed ItineraryCard design but without the confirm button.

function TripViewAccordion({ itinerary }: { itinerary: Itinerary }) {
  const [openDay, setOpenDay] = useState<number | null>(1)
  const totalDays = itinerary.totalDays ?? itinerary.days.length
  const currentOpenDay = openDay ?? 1

  return (
    <div>
      {/* Journey header */}
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
              <button
                className="w-full text-left px-6 py-4 flex items-center gap-4 hover:bg-briefing-cream/50 transition-colors"
                onClick={() => setOpenDay(isOpen ? null : day.day)}
              >
                <span
                  className={[
                    'inline-flex items-center justify-center w-11 h-11 rounded-xl font-black text-lg flex-shrink-0 transition-colors',
                    isOpen ? 'bg-basel-brick text-white' : 'bg-zen-black/5 text-zen-black/40',
                  ].join(' ')}
                >
                  {paddedDay}
                </span>
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
                <ChevronDown
                  size={18}
                  className={[
                    'flex-shrink-0 transition-all duration-200',
                    isOpen ? 'rotate-180 text-basel-brick' : 'rotate-0 text-zen-black/20',
                  ].join(' ')}
                />
              </button>

              {isOpen && (
                <div className="px-6 pb-6 pt-2 space-y-6 border-t border-zen-black/5 bg-briefing-cream/30">
                  {day.activities.length > 0 && (
                    <div className="space-y-5">
                      {day.activities.map((act, idx) => (
                        <div key={idx} className="relative pl-7 border-l-[3px] border-basel-brick">
                          <span className="absolute -left-[6px] top-0.5 w-2.5 h-2.5 rounded-full bg-basel-brick" />
                          <p className="text-[10px] font-bold text-basel-brick uppercase tracking-widest flex items-center gap-1">
                            <Clock size={10} strokeWidth={2.5} />
                            {act.time}
                          </p>
                          <p className="font-bold text-base text-zen-black mt-1">{act.name}</p>
                          {act.notes && (
                            <p className="text-sm text-zen-black/60 mt-1.5 leading-relaxed">{act.notes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {day.accommodation && (
                    <div className="flex items-start gap-2">
                      <Hotel size={14} className="text-basel-brick flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                      <div>
                        <p className="text-[10px] font-bold text-basel-brick uppercase tracking-widest mb-1">ที่พัก</p>
                        <p className="text-sm text-zen-black leading-relaxed">{day.accommodation}</p>
                      </div>
                    </div>
                  )}

                  {day.transport && (
                    <div className="flex items-start gap-2">
                      <Train size={14} className="text-basel-brick flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                      <div>
                        <p className="text-[10px] font-bold text-basel-brick uppercase tracking-widest mb-1">การเดินทาง</p>
                        <p className="text-sm text-zen-black leading-relaxed">{day.transport}</p>
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
