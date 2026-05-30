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
  /** Curated activation code of the pre-planned trip — usable as-is in LINE. */
  shareCode?: string | null
}

export default function ItineraryCard({
  itinerary,
  onConfirm,
  confirmLoading = false,
  coverImage = null,
  shareCode = null,
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

      {/* Curated code (use as-is in LINE) + Duplicate-or-Edit (make your own copy) */}
      <div className="pt-5 mt-5 border-t border-zen-black/10 space-y-3">
        {shareCode && (
          <button
            onClick={() => navigator.clipboard.writeText(`/activate ${shareCode}`)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-lg bg-zen-black text-white hover:bg-basel-brick transition-colors"
            title="คัดลอกคำสั่ง /activate"
          >
            <div className="flex flex-col items-start leading-tight">
              <span className="text-[8px] font-black uppercase tracking-[0.3em] text-white/50">
                ใช้แผนนี้เลยบน LINE · Use as-is
              </span>
              <span className="font-mono text-lg font-bold">{shareCode}</span>
            </div>
            <span className="text-[9px] border border-white/30 px-2 py-1 font-bold uppercase flex items-center gap-1">
              <Copy size={11} strokeWidth={2.5} /> Copy
            </span>
          </button>
        )}
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
