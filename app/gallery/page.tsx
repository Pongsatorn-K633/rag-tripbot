'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { CloudUpload, CheckCircle, Trash2, ArrowRight, Flower } from 'lucide-react'
import { motion } from 'motion/react'
import ItineraryCard from '@/app/components/ItineraryCard'
import ActivationBanner from '@/app/components/ActivationBanner'
import { IMG } from '@/lib/images'

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
  totalDays?: number | null
}

type UploadState = 'idle' | 'uploading' | 'review' | 'saving' | 'done'

// ── Stock image pool (reused from Home) ──────────────────────────────────────

const STOCK_IMAGES = [IMG.stock1, IMG.stock2, IMG.stock3, IMG.stock4]

function getUserId(): string {
  if (typeof window === 'undefined') return ''
  const stored = localStorage.getItem('tripbot_user_id')
  if (stored) return stored
  const newId = crypto.randomUUID()
  localStorage.setItem('tripbot_user_id', newId)
  return newId
}

// ── Gallery page ─────────────────────────────────────────────────────────────

export default function GalleryPage() {
  // Upload state
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [isDragging, setIsDragging] = useState(false)
  const [uploadedItinerary, setUploadedItinerary] = useState<Itinerary | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadShareCode, setUploadShareCode] = useState<string | null>(null)
  const [uploadStartDate, setUploadStartDate] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Saved trips state
  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>([])
  const [tripsLoading, setTripsLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // ── Load saved trips on mount ──────────────────────────────────────────────
  useEffect(() => {
    async function loadTrips() {
      try {
        const userId = getUserId()
        const res = await fetch(`/api/trips?userId=${encodeURIComponent(userId)}`)
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
  }, [])

  // ── Upload handlers ────────────────────────────────────────────────────────

  async function processFile(file: File) {
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
      const userId = getUserId()
      const saveRes = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          title: uploadedItinerary.title,
          itinerary: uploadedItinerary,
          source: 'upload',
          startDate: uploadStartDate || undefined,
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

      // Refresh saved trips list
      setSavedTrips((prev) => [{ id: trip.id, title: trip.title, createdAt: trip.createdAt, itinerary: uploadedItinerary }, ...prev])
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
    setUploadState('idle')
  }

  // ── Delete handler ─────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/trips/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('ลบไม่สำเร็จ')
      setSavedTrips((prev) => prev.filter((t) => t.id !== id))
    } catch {
      alert('ไม่สามารถลบแผนได้ กรุณาลองใหม่')
    } finally {
      setDeleteConfirm(null)
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
        <h1 className="text-5xl md:text-7xl font-headline font-extrabold tracking-tighter text-basel-brick mb-6">The Digital Curator</h1>
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

            {(uploadState === 'idle' || uploadState === 'uploading') && (
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
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6 border-b-2 border-zen-black/5 pb-8">
          <div>
            <span className="text-basel-brick font-extrabold text-sm uppercase tracking-[0.3em] mb-4 block font-headline">Your Collection</span>
            <h2 className="text-5xl font-headline font-black tracking-tighter text-zen-black">แผนการเดินทางของคุณ</h2>
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
          const TEMPLATE_TITLES = new Set([
            'Tokyo & Osaka Classic',
            'Hokkaido Snow Adventure',
            'Kyoto Cultural Immersion',
            'Tokyo Summer Explorer',
          ])
          const visible = savedTrips.filter(
            (t) => t.source !== 'template' && !TEMPLATE_TITLES.has(t.title),
          )
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
              {visible.map((trip, idx) => {
                const itin = trip.itinerary as Itinerary | null
                const imgSrc = STOCK_IMAGES[idx % STOCK_IMAGES.length]
                const tripTotalDays = itin?.totalDays ?? trip.totalDays ?? null
                return (
                  <motion.div
                    key={trip.id}
                    whileHover={{ y: -10 }}
                    className="group flex flex-col bg-white p-4 rounded-xl shadow-sm hover:shadow-2xl transition-all duration-300 relative"
                  >
                    {/* Delete button */}
                    <button
                      onClick={() => setDeleteConfirm(trip.id)}
                      className="absolute top-6 right-6 z-10 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-white/80 rounded-full hover:bg-basel-brick hover:text-white text-zen-black/40"
                      aria-label="ลบแผน"
                    >
                      <Trash2 size={14} />
                    </button>

                    <div className="relative aspect-[4/5] overflow-hidden mb-6 bg-briefing-cream rounded-lg">
                      <img
                        alt={trip.title}
                        className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105"
                        src={imgSrc}
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
                    <div className="mt-auto text-basel-brick font-black text-xs uppercase tracking-widest flex items-center gap-2 group-hover:translate-x-2 transition-transform font-headline">
                      VIEW <ArrowRight size={14} />
                    </div>
                  </motion.div>
                )
              })}
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
                className="flex-1 py-3 border border-zen-black/20 font-bold text-sm font-headline uppercase tracking-widest hover:bg-zen-black hover:text-briefing-cream transition-all"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-3 bg-basel-brick text-white font-bold text-sm font-headline uppercase tracking-widest hover:bg-zen-black transition-all"
              >
                ลบ
              </button>
            </div>
          </div>
        </div>
      )}

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
              <div className="absolute inset-0 opacity-5 mix-blend-multiply">
                <img
                  alt="background pattern"
                  className="w-full h-full object-cover grayscale scale-150 rotate-12"
                  src={IMG.logo}
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
