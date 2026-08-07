'use client'

import { useState, useRef, useCallback } from 'react'
import { CloudUpload, Check, Lock, ArrowRight, Sparkles, FileText } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import { useSession, signIn } from 'next-auth/react'
import ItineraryCard from '@/app/components/ItineraryCard'
import CoverUpload from '@/app/components/CoverUpload'
import SeigaihaBackdrop from '@/app/components/SeigaihaBackdrop'
import DocToTripForm from '@/app/components/DocToTripForm'
import { isV3 } from '@/lib/trips/itinerary-model'
import type { Itinerary, ItineraryV3, AnyItinerary } from '@/lib/itinerary-types'

type UploadState = 'idle' | 'uploading' | 'review' | 'saving' | 'done'

// ── AI Scanner ───────────────────────────────────────────────────────────────
// Upload a PDF / screenshot / Excel → the VLM extracts the itinerary → the user
// completes the blanks → saved as a Trip (they then generate the LINE code in
// /my-trips).
//
// Dark page: '/ai-scanner' is in GRAPHITE_ROUTES, so ClientLayout paints the
// Graphite canvas and the navbar + footer take their dark treatment. Page type
// is Cloud; the working surfaces (dropzone, review form) stay WHITE cards on
// top, because that's where dense form UI belongs.

export default function AiScannerPage() {
  const { data: session } = useSession()
  const isSignedIn = !!session?.user

  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [isDragging, setIsDragging] = useState(false)
  const [uploadedItinerary, setUploadedItinerary] = useState<AnyItinerary | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadStartDate, setUploadStartDate] = useState('')
  const [uploadCoverImage, setUploadCoverImage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Upload handlers ────────────────────────────────────────────────────────

  async function processFile(file: File) {
    // Guest gate — AI file extraction is member-only (the VLM is expensive).
    if (!isSignedIn) {
      signIn(undefined, { callbackUrl: '/ai-scanner' })
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

  // Save the (possibly user-completed) itinerary as a Trip. Used by both the V3
  // completion form (passes its edited itinerary) and the legacy read-only card.
  async function doSave(itin: AnyItinerary) {
    setUploadState('saving')
    try {
      const saveRes = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: (itin as { title?: string }).title ?? 'Trip',
          itinerary: itin,
          source: 'upload',
          startDate: uploadStartDate || undefined,
          coverImage: uploadCoverImage || undefined,
        }),
      })
      if (!saveRes.ok) throw new Error('บันทึกไม่สำเร็จ')

      // Trip saved without a shareCode — the user generates it in /my-trips.
      setUploadState('done')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
      setUploadError(message)
      setUploadState('review')
    }
  }

  function handleReUpload() {
    setUploadedItinerary(null)
    setUploadError(null)
    setUploadStartDate('')
    setUploadCoverImage(null)
    setUploadState('idle')
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const showDropzone = uploadState === 'idle' || uploadState === 'uploading'

  return (
    // pt-32 / pb-24 / header mb-16 — /discover's exact vertical rhythm, shared
    // by all four dark pages.
    <main className="pt-32 pb-24 px-4 sm:px-6 max-w-7xl mx-auto text-briefing-cream">
      <SeigaihaBackdrop />

      {/* Hero — the SAME type scale as /discover's "Ready-to-go Trips" and
          /create's "Create": font-headline bold, 3xl→5xl, tracking-tight, with
          the Cloud/70 Thai subtitle. (Was a 7xl Ocean "The Digital Curator",
          the last survivor of the pre-2026-07 type scale.) */}
      {/* mb-10, not the other dark pages' mb-16: those open with a browsable
          gallery, this one opens with the single thing you came to do — the
          dropzone reads as part of the heading rather than a separate slab. */}
      <header className="mb-12">
        {/* Title row — the "Create →" shortcut rides on the TITLE's line,
            right-aligned, exactly like /my-trips' "Discover →" and /discover's
            "My Trips →". Here it doubles as the way back to the hub this page
            was launched from. */}
        <div className="flex items-center gap-4">
          <h1 className="font-headline font-bold text-3xl md:text-5xl tracking-tight">
            AI Scanner
          </h1>
          <Link
            href="/create"
            // translate-y: nudged down off the title's optical centre so it
            // sits nearer the type's baseline than its cap height.
            className="group ml-auto flex shrink-0 translate-y-1.5 items-center gap-1.5 font-headline text-xs font-bold tracking-wide text-briefing-cream/80 transition-colors hover:text-basel-brick"
          >
            Create
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
        <p className="mt-2.5 text-briefing-cream/70 font-sans">
          มีแผนอยู่แล้ว? อัปโหลดไฟล์เดิมของคุณ ให้ AI แปลงเป็นแผนที่ และสามารถแก้ไขได้ในเว็บไซต์
        </p>
      </header>

      <section className="mb-20">
        {uploadError && (
          <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 font-detail text-[13px] leading-relaxed text-red-100">
            <span className="mt-px font-bold">!</span>
            <span>{uploadError}</span>
          </div>
        )}

        {/* lg:12-col split. On MOBILE the dropzone comes FIRST (order-1) and the
            explainer sits under it — the action is what the user came for, and
            burying it under three lines of Thai copy pushed it below the fold.
            On desktop the explainer returns to the left rail. */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-stretch">
          {/* Explainer — the /create glass card (white/15 hairline over white/10
              with blur), not the old solid Ocean block. */}
          <div className="order-2 flex flex-col rounded-3xl border border-white/15 bg-white/10 p-8 backdrop-blur-sm lg:order-1 lg:col-span-4">
            <h2 className="font-headline text-2xl font-bold tracking-tight">Digitize Your Plans</h2>
            <p className="mt-2.5 font-sans text-briefing-cream/70 leading-relaxed">
              เปลี่ยนแผนเที่ยวธรรมดาให้ใช้งานสะดวก! แค่อัปโหลดแพลนของคุณ dopamichi
              จะแปลงข้อมูลทั้งหมดให้กลายเป็น Chatbot คู่หูส่วนตัวที่รู้ทุกตารางเวลา
              และพร้อมตอบทุกคำถามตลอดทริป
            </p>
            {/* Feature pills — the app's chip vocabulary (rounded-full, Ocean
                glyph), replacing the uppercase-tracked checkmark list. */}
            <div className="mt-auto flex flex-wrap gap-2 pt-8">
              {[
                { icon: Sparkles, label: 'AI Extraction' },
                { icon: FileText, label: 'PDF · Image · Excel' },
                { icon: Check, label: 'Instant Sync' },
              ].map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 font-detail text-[11px] font-semibold text-briefing-cream/85"
                >
                  <Icon className="size-3.5 text-basel-brick" strokeWidth={2.5} />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* The working column: dropzone → review → done */}
          <div className="order-1 lg:order-2 lg:col-span-8">
            {showDropzone && !isSignedIn && (
              <div className="flex min-h-[320px] items-center justify-center rounded-3xl bg-white p-6 shadow-lg md:min-h-[420px]">
                <div className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zen-black/10 p-8 text-center font-detail sm:p-12">
                  <div className="mb-6 grid size-16 place-items-center rounded-full bg-basel-brick/10">
                    <Lock className="size-7 text-basel-brick" strokeWidth={2.5} />
                  </div>
                  <h3 className="text-lg font-extrabold tracking-tight text-zen-black">
                    เข้าสู่ระบบเพื่ออัปโหลด
                  </h3>
                  <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-graphite/80">
                    สมัครสมาชิกฟรีเพื่อใช้ฟีเจอร์ AI อ่านไฟล์และบันทึกทริปของคุณ
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-graphite/60">
                    Create a free account to use AI file extraction and save your trips.
                  </p>
                  <button
                    onClick={() => signIn(undefined, { callbackUrl: '/ai-scanner' })}
                    className="mt-7 rounded-full bg-zen-black px-8 py-3 text-sm font-semibold text-white shadow-md shadow-zen-black/25 transition-all hover:bg-basel-brick"
                  >
                    Sign up / Sign in
                  </button>
                </div>
              </div>
            )}

            {showDropzone && isSignedIn && (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className="flex min-h-[320px] items-center justify-center rounded-3xl bg-white p-6 shadow-lg md:min-h-[420px]"
              >
                {/* The dashed inner frame IS the drop target's feedback — it
                    turns Ocean on drag-over (was a 12px solid Midnight picture
                    frame around the whole block). */}
                <div
                  className={[
                    'flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center font-detail transition-colors duration-300 sm:p-12',
                    isDragging ? 'border-basel-brick bg-basel-brick/5' : 'border-zen-black/10',
                  ].join(' ')}
                >
                  {uploadState === 'uploading' ? (
                    <>
                      <div className="mb-6 grid size-16 place-items-center rounded-full bg-basel-brick/10">
                        <div className="size-7 animate-spin rounded-full border-[3px] border-basel-brick border-t-transparent" />
                      </div>
                      <h3 className="text-lg font-extrabold tracking-tight text-zen-black">
                        กำลังวิเคราะห์...
                      </h3>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-graphite/80">
                        AI กำลังอ่านและแปลงข้อมูลจากไฟล์ของคุณ
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="mb-6 grid size-16 place-items-center rounded-full bg-basel-brick/10">
                        <CloudUpload className="size-7 text-basel-brick" strokeWidth={2.5} />
                      </div>
                      <h3 className="text-lg font-extrabold tracking-tight text-zen-black">
                        Drag and drop your itinerary
                      </h3>
                      <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-graphite/80">
                        ลากไฟล์มาวางที่นี่ หรือเลือกจากอุปกรณ์ของคุณ
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-graphite/60">
                        Image (.png, .jpg) · PDF · Excel (.xlsx) — up to 10MB
                      </p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-7 rounded-full bg-zen-black px-8 py-3 text-sm font-semibold text-white shadow-md shadow-zen-black/25 transition-all hover:bg-basel-brick"
                      >
                        เลือกไฟล์จากอุปกรณ์
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

            {(uploadState === 'review' || uploadState === 'saving' || uploadState === 'done') &&
              uploadedItinerary && (
                <div className="rounded-3xl bg-white p-5 font-detail shadow-lg sm:p-6">
                  {uploadState === 'done' ? (
                    // Mirrors PlanPreviewModal's success step exactly: Ocean-tint
                    // check disc, extrabold heading, graphite/80 body, pill pair.
                    <div className="space-y-4 py-6 text-center">
                      <div className="mx-auto grid size-16 place-items-center rounded-full bg-basel-brick/10">
                        <Check className="size-7 text-basel-brick" strokeWidth={3} aria-hidden />
                      </div>
                      <h3 className="text-lg font-extrabold tracking-tight text-zen-black">
                        บันทึกแล้ว!
                      </h3>
                      <p className="mx-auto max-w-sm text-[13px] leading-relaxed text-graphite/80">
                        เพิ่มทริปของคุณในหน้า My Trips แล้ว — แก้ไขได้อิสระ และรับรหัส LINE ได้ที่นั่นเลย
                      </p>
                      <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                        <Link
                          href="/my-trips"
                          className="flex-1 rounded-full bg-zen-black py-3 text-center text-sm font-semibold text-white shadow-md shadow-zen-black/25 transition-all hover:bg-basel-brick"
                        >
                          Go to My Trips
                        </Link>
                        <button
                          onClick={handleReUpload}
                          className="flex-1 rounded-full border border-zen-black/15 bg-white py-3 text-sm font-semibold text-zen-black transition-colors hover:border-basel-brick/50 hover:text-basel-brick"
                        >
                          อัปโหลดไฟล์อื่น
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="mb-4 flex items-start gap-2 rounded-2xl bg-briefing-cream px-3.5 py-3 text-[12px] leading-relaxed text-graphite/80">
                        <Sparkles className="mt-px size-4 shrink-0 text-basel-brick" strokeWidth={2.5} />
                        <span>ตรวจสอบแผนที่ AI สกัดออกมา เติมช่องที่ยังว่าง แล้วกดยืนยันเพื่อบันทึก</span>
                      </div>

                      {/* Trip meta — the DateStep's label vocabulary
                          (uppercase-wider Ocean at 11px, rounded-xl fields). */}
                      <div className="mb-4">
                        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-basel-brick">
                          วันเริ่มเดินทาง · Start date (optional)
                        </label>
                        <input
                          type="date"
                          value={uploadStartDate}
                          onChange={(e) => setUploadStartDate(e.target.value)}
                          disabled={uploadState === 'saving'}
                          className="w-full rounded-xl border border-zen-black/15 bg-white px-4 py-2.5 text-sm font-medium text-zen-black transition-colors focus:border-basel-brick focus:outline-none disabled:opacity-40"
                        />
                      </div>

                      <div className="mb-4">
                        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-basel-brick">
                          รูปหน้าปก · Cover image (optional)
                        </label>
                        <CoverUpload
                          value={uploadCoverImage}
                          onChange={setUploadCoverImage}
                          disabled={uploadState === 'saving'}
                        />
                      </div>

                      {isV3(uploadedItinerary) ? (
                        <DocToTripForm
                          initial={uploadedItinerary as ItineraryV3}
                          saving={uploadState === 'saving'}
                          onSave={doSave}
                        />
                      ) : (
                        <ItineraryCard
                          itinerary={uploadedItinerary as Itinerary}
                          onConfirm={() => uploadedItinerary && doSave(uploadedItinerary)}
                          confirmLoading={uploadState === 'saving'}
                        />
                      )}

                      <button
                        onClick={handleReUpload}
                        disabled={uploadState === 'saving'}
                        className="mt-2.5 w-full rounded-full border border-zen-black/15 bg-white py-3 text-sm font-semibold text-zen-black transition-colors hover:border-basel-brick/50 hover:text-basel-brick disabled:opacity-40"
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

      {/* Footer pointer to /my-trips — a hairline rule + the ghost pill the dark
          pages use, instead of the old solid Midnight block. AnimatePresence
          hides it on the done step, where the same link is already the primary
          CTA two inches above. */}
      <AnimatePresence>
        {uploadState !== 'done' && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="border-t border-white/10 pt-10 text-center"
          >
            <p className="font-sans text-sm text-briefing-cream/60">
              แผนที่บันทึกแล้วอยู่ในหน้า My Trips
            </p>
            <Link
              href="/my-trips"
              className="group mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-2.5 font-detail text-sm font-semibold text-briefing-cream transition-colors hover:border-basel-brick/60 hover:text-basel-brick"
            >
              Go to My Trips
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  )
}
