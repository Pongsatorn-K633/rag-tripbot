'use client'

import Image from 'next/image'
import { motion } from 'motion/react'
import { ArrowRight, Heart, Sparkles, CalendarCheck } from 'lucide-react'
import { resolveCoverImage } from '@/lib/cover-image'
import { formatRanges } from '@/lib/availability'
import type { TripAvailability } from '@/lib/itinerary-types'
import { type Itinerary } from '@/app/components/TemplateCard'

/** The shape both /pre-planned and /saved fetch from GET /api/templates. */
export interface PlanTemplate {
  id: string
  title: string
  description: string | null
  itinerary: Itinerary
  coverImage: string | null
  coverImages?: string[] | null
  totalDays: number
  season: string | null
  availability: TripAvailability | null
  shareCode: string | null
  createdAt: string
}

const CARD_VARIANT = {
  light: { card: 'bg-white', title: 'text-zen-black', desc: 'text-zen-black/60', avail: 'text-zen-black/50', availLabel: 'text-zen-black/40' },
  dark: { card: 'bg-[#0A0A0A] border border-white/10', title: 'text-briefing-cream', desc: 'text-briefing-cream/60', avail: 'text-briefing-cream/50', availLabel: 'text-briefing-cream/40' },
} as const

export default function PlanCard({
  tpl,
  recommended = false,
  perfectFit = false,
  dimmed = false,
  isSaved = false,
  isPending = false,
  variant = 'light',
  onOpen,
  onHeart,
}: {
  tpl: PlanTemplate
  recommended?: boolean
  /** The user's picked window length equals this trip's length — fills their dates exactly. */
  perfectFit?: boolean
  dimmed?: boolean
  isSaved?: boolean
  isPending?: boolean
  /** 'light' (website, default) or 'dark' (LIFF dark mode). */
  variant?: 'light' | 'dark'
  onOpen: () => void
  /** Omit to hide the heart button (e.g. in the LINE LIFF browse, no web login). */
  onHeart?: (e: React.MouseEvent) => void
}) {
  const imgSrc = resolveCoverImage(tpl.coverImage, tpl.id)
  const rec = tpl.availability?.recommended ?? []
  const avail = tpl.availability?.available ?? []
  const c = CARD_VARIANT[variant]

  return (
    <motion.div
      whileHover={{ y: dimmed ? 0 : -10 }}
      className={`group flex flex-col ${c.card} p-4 rounded-xl shadow-sm hover:shadow-2xl transition-shadow duration-300 cursor-pointer relative ${
        dimmed ? 'opacity-55 hover:opacity-90' : ''
      }`}
      onClick={onOpen}
    >
      {/* Perfect-fit takes priority over the recommended badge — only one shows. */}
      {perfectFit ? (
        <div className="absolute top-6 left-6 z-20 bg-emerald-600 text-white px-3 py-1.5 text-[9px] font-black uppercase tracking-widest font-headline flex items-center gap-1.5 shadow-md">
          <CalendarCheck size={11} strokeWidth={3} /> พอดีกับจำนวนวัน
        </div>
      ) : recommended ? (
        <div className="absolute top-6 left-6 z-20 bg-basel-brick text-white px-3 py-1.5 text-[9px] font-black uppercase tracking-widest font-headline flex items-center gap-1.5 shadow-md">
          <Sparkles size={11} strokeWidth={3} /> เหมาะกับวันที่คุณเลือก
        </div>
      ) : null}

      {onHeart && (
        <button
          onClick={onHeart}
          disabled={isPending}
          aria-label={isSaved ? 'Unsave' : 'Save'}
          className="absolute top-6 right-6 z-20 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform disabled:opacity-60"
        >
          <motion.div
            key={isSaved ? 'saved' : 'unsaved'}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            <Heart size={18} fill={isSaved ? '#B43325' : 'none'} stroke={isSaved ? '#B43325' : '#231a0e'} strokeWidth={2.5} />
          </motion.div>
        </button>
      )}

      <div className="relative aspect-[4/5] overflow-hidden mb-6 bg-briefing-cream rounded-lg">
        <Image
          src={imgSrc}
          alt={tpl.title}
          fill
          className="object-cover transition-all duration-700 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
        />
        <div className="absolute bottom-0 left-0 w-full p-4 sm:p-6 bg-gradient-to-t from-zen-black/80 to-transparent">
          <span className="bg-basel-brick text-briefing-cream px-3 py-1 text-[10px] font-black uppercase tracking-widest font-headline self-start">
            {tpl.totalDays} DAYS
          </span>
        </div>
      </div>
      <h3 className={`text-2xl font-headline font-bold mb-2 ${c.title}`}>{tpl.title}</h3>
      {tpl.description && (
        // Cover shows the tagline (Template.description); the full text lives in the preview.
        <p className={`text-sm font-sans leading-relaxed mb-4 line-clamp-2 ${c.desc}`}>{tpl.description}</p>
      )}

      {/* Travel periods */}
      <div className="mb-4 space-y-1">
        {rec.length > 0 && (
          <p className="text-[11px] text-basel-brick font-bold">
            <span className="uppercase tracking-widest text-[9px] text-basel-brick/60 mr-1">แนะนำ</span>
            {formatRanges(rec, 'th')}
          </p>
        )}
        <p className={`text-[11px] ${c.avail}`}>
          <span className={`uppercase tracking-widest text-[9px] mr-1 ${c.availLabel}`}>เปิดให้เที่ยว</span>
          {formatRanges(avail, 'th')}
        </p>
      </div>

      <button className="mt-auto text-basel-brick font-black text-xs uppercase tracking-widest flex items-center gap-2 group-hover:translate-x-2 transition-transform font-headline">
        PREVIEW <ArrowRight size={14} />
      </button>
    </motion.div>
  )
}
