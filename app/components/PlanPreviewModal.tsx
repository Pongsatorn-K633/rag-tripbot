'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import { useSession, signIn } from 'next-auth/react'
import ItineraryCard from '@/app/components/ItineraryCard'
import type { PlanTemplate } from '@/app/components/PlanCard'

type SaveState = 'idle' | 'saving' | 'done'

/**
 * Preview + confirm modal for a pre-planned trip. Self-contained: owns its own
 * save state and posts a Trip copy to /api/trips. Shared by /pre-planned + /saved.
 * The chosen travel date comes from the page's date filter (defaultStartDate) and
 * is saved silently — no date inputs in the modal itself.
 */
export default function PlanPreviewModal({
  template,
  defaultStartDate = '',
  callbackUrl,
  onClose,
}: {
  template: PlanTemplate | null
  defaultStartDate?: string
  callbackUrl: string
  onClose: () => void
}) {
  const { data: session } = useSession()
  const [saveState, setSaveState] = useState<SaveState>('idle')

  // Reset state whenever a different template is opened.
  useEffect(() => {
    if (template) setSaveState('idle')
  }, [template])

  async function handleConfirm() {
    if (!template) return
    if (!session?.user) {
      signIn(undefined, { callbackUrl })
      return
    }
    setSaveState('saving')
    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: template.title,
          itinerary: template.itinerary,
          source: 'plan',
          templateId: template.id,
          coverImage: template.coverImage ?? undefined,
          startDate: defaultStartDate || undefined,
        }),
      })
      if (!res.ok) throw new Error('Failed to save template')
      const { trip } = await res.json()

      // Auto-generate a fresh activation code so it's ready to redeem in My Trip
      // (not shown here — the user gets it on the My Trip page).
      try {
        const primaryCity = template.itinerary?.days?.[0]?.location ?? 'JPN'
        await fetch('/api/activate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tripId: trip.id, primaryCity }),
        })
      } catch {
        // Non-fatal — the user can still generate the code in My Trip.
      }
      setSaveState('done')
    } catch (err) {
      console.error('Save error:', err)
      setSaveState('idle')
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    }
  }

  function handleClose() {
    setSaveState('idle')
    onClose()
  }

  return (
    <AnimatePresence>
      {template && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-4 sm:py-10 px-2 sm:px-4"
          style={{ backgroundColor: 'rgba(35,26,14,0.75)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget && saveState !== 'saving') handleClose()
          }}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-lg bg-briefing-cream border border-zen-black/10 shadow-2xl overflow-hidden rounded-xl"
          >
            {/* Top-bar close (same as the My Trip view) */}
            {saveState !== 'saving' && (
              <div className="px-4 sm:px-6 py-3 flex items-center justify-end border-b border-zen-black/10">
                <button onClick={handleClose} className="text-zen-black/40 hover:text-zen-black text-2xl leading-none transition-colors" aria-label="ปิด">&times;</button>
              </div>
            )}
            <div className="px-4 sm:px-6 py-5">
              {saveState === 'done' ? (
                <div className="text-center py-8 space-y-4">
                  <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-600 text-2xl">✓</span>
                  </div>
                  <h3 className="font-headline font-black text-xl text-zen-black">คัดลอกเรียบร้อย!</h3>
                  <p className="text-sm text-zen-black/60">
                    เพิ่มทริปของคุณในหน้า My Trip แล้ว — แก้ไขได้อิสระ และรับรหัส LINE ได้ที่นั่นเลย
                  </p>
                  <div className="flex gap-3 pt-2">
                    <Link
                      href="/my-trip"
                      className="flex-1 py-3 rounded-lg bg-basel-brick text-white font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black transition-all text-center"
                    >
                      Go to My Trip
                    </Link>
                    <button
                      onClick={handleClose}
                      className="flex-1 py-3 rounded-lg border-2 border-zen-black font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black hover:text-briefing-cream transition-all"
                    >
                      เลือกแพลนอื่น
                    </button>
                  </div>
                </div>
              ) : (
                <ItineraryCard
                  itinerary={template.itinerary}
                  onConfirm={handleConfirm}
                  confirmLoading={saveState === 'saving'}
                  coverImage={template.coverImage}
                  shareCode={template.shareCode}
                />
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
