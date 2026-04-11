'use client'

import { useState, useCallback, useEffect } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { Star, Banknote, Timer } from 'lucide-react'
import type { Choice } from '@/lib/itinerary-types'
import CategoryIcon from '@/app/components/CategoryIcon'

/**
 * IG-style swipeable card carousel for itinerary choices.
 *
 * Uses embla-carousel for native-feeling momentum on both desktop (mouse drag)
 * and mobile (touch swipe). Snaps to one card at a time with dot indicators.
 */
export default function ChoiceCarousel({ choice }: { choice: Choice }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: false,
  })
  const [activeIndex, setActiveIndex] = useState(0)

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setActiveIndex(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    emblaApi.on('select', onSelect)
    return () => { emblaApi.off('select', onSelect) }
  }, [emblaApi, onSelect])

  function scrollTo(idx: number) {
    emblaApi?.scrollTo(idx)
  }

  return (
    <div className="border border-blue-200 bg-blue-50/30 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2 border-b border-blue-100">
        <Star size={12} className="text-blue-600 flex-shrink-0" strokeWidth={2.5} />
        <p className="text-[10px] font-bold text-blue-800 uppercase tracking-widest flex-1">
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
              className="flex-[0_0_85%] min-w-0 bg-white border border-blue-100 rounded-lg px-4 py-3"
            >
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                {opt.category && (
                  <CategoryIcon category={opt.category} size={14} className="text-blue-500" />
                )}
                <span className="font-bold text-sm text-zen-black">{opt.name}</span>
                {opt.cost && (
                  <span className="text-[10px] font-bold text-basel-brick flex items-center gap-0.5 ml-auto">
                    <Banknote size={10} strokeWidth={2} /> {opt.cost}
                  </span>
                )}
              </div>
              {opt.notes && (
                <p className="text-xs text-zen-black/60 leading-relaxed">{opt.notes}</p>
              )}
              {opt.duration && (
                <p className="text-[10px] text-zen-black/40 mt-1.5 flex items-center gap-0.5">
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
                idx === activeIndex
                  ? 'w-2 h-2 bg-blue-600'
                  : 'w-1.5 h-1.5 bg-blue-300 hover:bg-blue-400'
              }`}
              aria-label={`Option ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
