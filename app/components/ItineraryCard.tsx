'use client'

import { Copy, ArrowRight } from 'lucide-react'
import type { Itinerary } from '@/lib/itinerary-types'
import ItineraryView from '@/app/components/ItineraryView'
import { resolveCoverImage } from '@/lib/cover-image'
import { IMG } from '@/lib/images'

/**
 * Itinerary preview card for the website (confirm + save flow). The hero photo +
 * day-by-day body are rendered by the shared <ItineraryView> — the SAME component
 * the LINE LIFF page uses — so the two look identical. This file only adds the
 * website chrome: the Confirm button. The activation code is NOT shown here — it
 * is minted per-user with real travel dates and revealed only in My Trip.
 */

interface ItineraryCardProps {
  itinerary: Itinerary
  onConfirm?: () => void
  confirmLoading?: boolean
  coverImage?: string | null
  /** Show the Duplicate-or-Edit button greyed out + non-clickable (e.g. admin preview). */
  viewOnly?: boolean
}

export default function ItineraryCard({
  itinerary,
  onConfirm,
  confirmLoading = false,
  coverImage = null,
  viewOnly = false,
}: ItineraryCardProps) {
  const totalDays = itinerary.totalDays ?? itinerary.days.length
  const heroImage = coverImage ? resolveCoverImage(coverImage, itinerary.title ?? 'trip') : IMG.liffHero
  const subtitle = `${totalDays} วัน${itinerary.season ? ` · ${itinerary.season}` : ''}`

  return (
    <div>
      {/* Hero + journey — shared renderer, flush like the LIFF (no extra box) */}
      <ItineraryView
        itinerary={itinerary}
        variant="light"
        hero={{ image: heroImage, title: itinerary.title ?? 'แผนการเดินทาง', subtitle }}
      />

      {/* Duplicate-or-Edit — next step asks for travel dates before saving.
          In view-only mode (e.g. admin preview) it's shown greyed + non-clickable. */}
      {(onConfirm || viewOnly) && (
        <div className="pt-5 mt-5 border-t border-zen-black/10 space-y-3">
          <button
            onClick={viewOnly ? undefined : onConfirm}
            disabled={confirmLoading || viewOnly}
            className={`group w-full py-4 rounded-lg font-headline font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2.5 ${
              viewOnly
                ? 'bg-zen-black/15 text-zen-black/40 cursor-not-allowed'
                : 'bg-basel-brick text-white hover:bg-zen-black disabled:opacity-50'
            }`}
          >
            {confirmLoading ? (
              'กำลังบันทึก...'
            ) : (
              <>
                <Copy size={15} strokeWidth={2.5} />
                Duplicate or Edit
                <ArrowRight size={15} strokeWidth={2.5} className="transition-transform group-hover:translate-x-1" />
              </>
            )}
          </button>
          <p className="text-[13px] text-zen-black/50 text-center leading-relaxed">
            {viewOnly ? (
              <>พรีวิวสำหรับแอดมิน — คัดลอก/แก้ไขได้จากฝั่งผู้ใช้ <br />Admin preview — duplicate/edit is available on the traveler side.</>
            ) : (
              <>เลือกวันเดินทางในขั้นถัดไป แล้วแก้ไขเพิ่มเติมได้ที่ My Trip :) <br />Pick your dates next, then fine-tune in My Trip. :)</>
            )}
          </p>
        </div>
      )}
    </div>
  )
}
