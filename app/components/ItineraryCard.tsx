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
 * website chrome: the Confirm button.
 */

interface ItineraryCardProps {
  itinerary: Itinerary
  onConfirm: () => void
  confirmLoading?: boolean
  coverImage?: string | null
  onClose?: () => void
}

export default function ItineraryCard({
  itinerary,
  onConfirm,
  confirmLoading = false,
  coverImage = null,
  onClose,
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
        onClose={onClose}
      />

      {/* Confirm button */}
      <div className="pt-5 mt-5 border-t border-zen-black/10 space-y-3">
        <button
          onClick={onConfirm}
          disabled={confirmLoading}
          className="group w-full py-4 rounded-lg bg-basel-brick text-white font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black transition-all disabled:opacity-50 flex items-center justify-center gap-2.5"
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
          แก้ไขทริปเพิ่มเติมได้ที่ My Trip หลังกดปุ่มนี้นะครับ :) <br />
          Further edits can be made in My Trip. :)
        </p>
      </div>
    </div>
  )
}
