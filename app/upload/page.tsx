'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import ItineraryCard from '@/app/components/ItineraryCard'
import ActivationBanner from '@/app/components/ActivationBanner'

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

type PageState = 'idle' | 'uploading' | 'review' | 'saving' | 'done'

export default function UploadPage() {
  const [pageState, setPageState] = useState<PageState>('idle')
  const [isDragging, setIsDragging] = useState(false)
  const [itinerary, setItinerary] = useState<Itinerary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [shareCode, setShareCode] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── File processing ──────────────────────────────────────────────────────

  async function processFile(file: File) {
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|png|jpe?g)$/i)) {
      setError('รองรับเฉพาะไฟล์ PDF, PNG หรือ JPG เท่านั้น')
      return
    }

    setError(null)
    setPageState('uploading')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'อัปโหลดไม่สำเร็จ')
      }
      const { itinerary: extracted } = await res.json()
      setItinerary(extracted)
      setPageState('review')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
      setError(message)
      setPageState('idle')
    }
  }

  // ── Drag-and-drop handlers ───────────────────────────────────────────────

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
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  // ── Save & activate ──────────────────────────────────────────────────────

  async function handleConfirm() {
    if (!itinerary) return
    setPageState('saving')

    try {
      let userId = ''
      if (typeof window !== 'undefined') {
        userId = localStorage.getItem('tripbot_user_id') ?? ''
        if (!userId) {
          userId = crypto.randomUUID()
          localStorage.setItem('tripbot_user_id', userId)
        }
      }

      const saveRes = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          title: itinerary.title,
          itinerary,
        }),
      })
      if (!saveRes.ok) throw new Error('บันทึกไม่สำเร็จ')
      const { trip } = await saveRes.json()

      const primaryCity = itinerary.days[0]?.location ?? 'JPN'
      const activateRes = await fetch('/api/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId: trip.id, primaryCity }),
      })
      if (!activateRes.ok) throw new Error('สร้างรหัสไม่สำเร็จ')
      const { shareCode: code } = await activateRes.json()

      setShareCode(code)
      setPageState('done')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
      setError(message)
      setPageState('review')
    }
  }

  function handleReUpload() {
    setItinerary(null)
    setShareCode(null)
    setError(null)
    setPageState('idle')
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen px-6 py-10" style={{ backgroundColor: '#1a2744' }}>
      {/* Top nav */}
      <div className="max-w-2xl mx-auto mb-8 flex items-center justify-between">
        <Link
          href="/"
          className="text-sm font-medium transition-opacity hover:opacity-70"
          style={{ color: '#c9a84c' }}
        >
          &larr; กลับหน้าแรก
        </Link>
        <Link
          href="/templates"
          className="text-sm font-medium transition-opacity hover:opacity-70"
          style={{ color: '#a0aec0' }}
        >
          ดูแพ็คเกจสำเร็จรูป &rarr;
        </Link>
      </div>

      {/* Page header */}
      <div className="max-w-2xl mx-auto mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2" style={{ color: '#c9a84c' }}>
          อัปโหลดแผนการเดินทาง
        </h1>
        <p className="text-base" style={{ color: '#a0aec0' }}>
          อัปโหลด PDF หรือภาพถ่ายแผนการเดินทางที่มีอยู่แล้ว แล้ว AI จะช่วยแปลงเป็นรูปแบบดิจิทัลให้
        </p>
        <p className="text-sm mt-1" style={{ color: '#718096' }}>
          Upload your existing itinerary PDF or screenshot — AI extracts the structured plan
        </p>
      </div>

      <div className="max-w-2xl mx-auto">

        {/* Error banner */}
        {error && (
          <div
            className="mb-4 px-4 py-3 rounded-lg text-sm"
            style={{ backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}
          >
            {error}
          </div>
        )}

        {/* Upload zone — shown when idle or uploading */}
        {(pageState === 'idle' || pageState === 'uploading') && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => pageState === 'idle' && fileInputRef.current?.click()}
            className="rounded-xl flex flex-col items-center justify-center gap-4 py-16 px-8 text-center transition-colors cursor-pointer"
            style={{
              border: `2px dashed ${isDragging ? '#c9a84c' : '#2a4070'}`,
              backgroundColor: isDragging ? '#1e3057' : '#16213a',
            }}
          >
            {pageState === 'uploading' ? (
              <>
                {/* Spinner */}
                <div
                  className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin"
                  style={{ borderColor: '#c9a84c', borderTopColor: 'transparent' }}
                />
                <p className="text-base font-medium" style={{ color: '#c9a84c' }}>
                  กำลังวิเคราะห์ไฟล์...
                </p>
                <p className="text-sm" style={{ color: '#718096' }}>
                  AI กำลังอ่านและแปลงข้อมูลแผนการเดินทาง
                </p>
              </>
            ) : (
              <>
                {/* Upload icon */}
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-2xl"
                  style={{ backgroundColor: '#1e3057', border: '1px solid #2a4070' }}
                >
                  &#8679;
                </div>
                <div>
                  <p className="text-base font-semibold mb-1" style={{ color: '#e2e8f0' }}>
                    ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์
                  </p>
                  <p className="text-sm" style={{ color: '#718096' }}>
                    รองรับ PDF, PNG, JPG — ขนาดสูงสุด 10 MB
                  </p>
                </div>
                <div
                  className="px-5 py-2 rounded-lg text-sm font-semibold"
                  style={{ backgroundColor: '#c9a84c', color: '#1a2744' }}
                >
                  เลือกไฟล์
                </div>
              </>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="hidden"
              onChange={handleFileChange}
              disabled={pageState === 'uploading'}
            />
          </div>
        )}

        {/* Review / Done state — show extracted itinerary */}
        {(pageState === 'review' || pageState === 'saving' || pageState === 'done') && itinerary && (
          <div>
            {pageState !== 'done' && (
              <div
                className="mb-4 px-4 py-3 rounded-lg text-sm"
                style={{ backgroundColor: '#1e3a5f', color: '#93c5fd', border: '1px solid #1e4080' }}
              >
                ตรวจสอบแผนการเดินทางที่ AI สกัดออกมา หากถูกต้องให้กดยืนยันและบันทึก
              </div>
            )}

            {pageState === 'done' && shareCode ? (
              <>
                <ActivationBanner shareCode={shareCode} />
                <button
                  onClick={handleReUpload}
                  className="mt-4 w-full py-3 rounded-lg font-semibold text-sm"
                  style={{ backgroundColor: '#1e3057', color: '#a0aec0', border: '1px solid #2a4070' }}
                >
                  อัปโหลดไฟล์อื่น
                </button>
              </>
            ) : (
              <>
                <ItineraryCard
                  itinerary={itinerary}
                  onConfirm={handleConfirm}
                  confirmLoading={pageState === 'saving'}
                />
                <button
                  onClick={handleReUpload}
                  disabled={pageState === 'saving'}
                  className="mt-3 w-full py-3 rounded-lg font-semibold text-sm transition-opacity disabled:opacity-40"
                  style={{ backgroundColor: 'transparent', color: '#718096', border: '1px solid #2a4070' }}
                >
                  อัปโหลดไฟล์ใหม่
                </button>
              </>
            )}
          </div>
        )}

        {/* Info callout */}
        {pageState === 'idle' && (
          <div
            className="mt-6 px-4 py-4 rounded-xl text-sm leading-relaxed"
            style={{ backgroundColor: '#16213a', border: '1px solid #2a4070', color: '#718096' }}
          >
            <p className="font-semibold mb-1" style={{ color: '#a0aec0' }}>
              หมายเหตุเกี่ยวกับการวิเคราะห์ไฟล์
            </p>
            <p>
              ระบบใช้ AI ในการอ่านและแปลงข้อมูลจากไฟล์ที่อัปโหลด —
              ภาพ (PNG, JPG) และ PDF ใช้ Gemini 2.0 Flash สำหรับวิเคราะห์และสกัดข้อมูล
              ผลลัพธ์อาจไม่สมบูรณ์ 100% — กรุณาตรวจสอบแผนการเดินทางก่อนบันทึก
            </p>
          </div>
        )}
      </div>

      <p className="mt-16 text-center text-xs" style={{ color: '#4a5568' }}>
        Phase 4 · Templates & Upload
      </p>
    </main>
  )
}
