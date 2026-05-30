'use client'

import { useState, useCallback, useEffect } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { Star, Banknote, Timer, Check } from 'lucide-react'
import type { Choice } from '@/lib/itinerary-types'
import CategoryIcon from '@/app/components/CategoryIcon'

/**
 * IG-style swipeable card carousel for itinerary choices.
 *
 * Uses embla-carousel for native-feeling momentum on both desktop (mouse drag)
 * and mobile (touch swipe). Snaps to one card at a time with dot indicators.
 *
 * `variant` themes it: 'light' (default, the website/light-mode look) or 'dark'
 * (the LIFF dark theme). Shared by the web ItineraryCard and the LIFF page.
 */
const VARIANTS = {
  light: {
    container: 'border-blue-200 bg-blue-50/30',
    headerBorder: 'border-blue-100',
    headerText: 'text-blue-800',
    card: 'bg-white border-blue-100',
    name: 'text-zen-black',
    notes: 'text-zen-black/60',
    duration: 'text-zen-black/40',
    star: 'text-blue-600',
    catIcon: 'text-blue-500',
    dotActive: 'bg-blue-600',
    dotInactive: 'bg-blue-300 hover:bg-blue-400',
  },
  dark: {
    container: 'border-white/10 bg-white/5',
    headerBorder: 'border-white/10',
    headerText: 'text-briefing-cream/70',
    card: 'bg-[#141414] border-white/10',
    name: 'text-briefing-cream',
    notes: 'text-briefing-cream/60',
    duration: 'text-briefing-cream/40',
    star: 'text-blue-400',
    catIcon: 'text-blue-400',
    dotActive: 'bg-blue-400',
    dotInactive: 'bg-white/20 hover:bg-white/40',
  },
} as const

export default function ChoiceCarousel({
  choice,
  variant = 'light',
}: {
  choice: Choice
  variant?: 'light' | 'dark'
}) {
  const v = VARIANTS[variant]
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: false,
  })
  const [activeIndex, setActiveIndex] = useState(choice.selected ?? 0)

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setActiveIndex(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    emblaApi.on('select', onSelect)
    return () => { emblaApi.off('select', onSelect) }
  }, [emblaApi, onSelect])

  // Open on the user's picked option (when customizing their copy).
  useEffect(() => {
    if (emblaApi && choice.selected != null) emblaApi.scrollTo(choice.selected)
  }, [emblaApi, choice.selected])

  function scrollTo(idx: number) {
    emblaApi?.scrollTo(idx)
  }

  return (
    <div className={`border rounded-lg overflow-hidden ${v.container}`}>
      {/* Header */}
      <div className={`px-4 py-3 flex items-center gap-2 border-b ${v.headerBorder}`}>
        <Star size={12} className={`${v.star} flex-shrink-0`} strokeWidth={2.5} />
        <p className={`text-[10px] font-bold uppercase tracking-widest flex-1 ${v.headerText}`}>
          {choice.label}
        </p>
        {choice.priority === 'mandatory' && (
          <span className="text-[8px] font-black uppercase tracking-widest bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
            Must-do
          </span>
        )}
      </div>

      {/* Embla carousel viewport */}
      <div className="overflow-hidden px-4 pt-3 pb-2" ref={emblaRef}>
        <div className="flex gap-3">
          {choice.options.map((opt, idx) => (
            <div
              key={idx}
              className={`flex-[0_0_85%] min-w-0 border rounded-lg px-4 py-3 ${
                choice.selected === idx ? 'border-basel-brick' : v.card
              }`}
            >
              {choice.selected === idx && (
                <span className="inline-flex items-center gap-1 mb-1.5 bg-basel-brick text-white text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded">
                  <Check size={9} strokeWidth={3} /> เลือกแล้ว
                </span>
              )}
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                {opt.category && <CategoryIcon category={opt.category} size={14} className={v.catIcon} />}
                <span className={`font-bold text-sm ${v.name}`}>{opt.name}</span>
                {opt.cost && (
                  <span className="text-[10px] font-bold text-basel-brick flex items-center gap-0.5 ml-auto">
                    <Banknote size={10} strokeWidth={2} /> {opt.cost}
                  </span>
                )}
              </div>
              {opt.notes && <p className={`text-xs leading-relaxed ${v.notes}`}>{opt.notes}</p>}
              {opt.duration && (
                <p className={`text-[10px] mt-1.5 flex items-center gap-0.5 ${v.duration}`}>
                  <Timer size={10} strokeWidth={2} /> {opt.duration}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Dot indicators */}
      {choice.options.length > 1 && (
        <div className="flex justify-center gap-1.5 pb-3">
          {choice.options.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => scrollTo(idx)}
              className={`rounded-full transition-all duration-200 ${
                idx === activeIndex ? `w-2 h-2 ${v.dotActive}` : `w-1.5 h-1.5 ${v.dotInactive}`
              }`}
              aria-label={`Option ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
