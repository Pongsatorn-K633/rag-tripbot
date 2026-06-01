'use client'

import { useState, useCallback, useEffect } from 'react'
import Image from 'next/image'
import useEmblaCarousel from 'embla-carousel-react'
import {
  ChevronDown, MapPin, AlertTriangle, Star, Hotel, Train, Clock, Banknote, Timer, Circle, CalendarCheck, ExternalLink,
} from 'lucide-react'
import type { AnyItinerary, Day, Activity, ActivityPriority } from '@/lib/itinerary-types'
import { PRIORITY_LABEL } from '@/lib/itinerary-types'
import { getRenderDays } from '@/lib/trips/itinerary-model'
import CategoryIcon from '@/app/components/CategoryIcon'
import ChoiceCarousel from '@/app/components/ChoiceCarousel'

/**
 * Shared, theme-aware day-by-day itinerary renderer — the single source of truth
 * for displaying a trip. Used by the LINE LIFF itinerary page (`variant` toggles
 * light/dark) AND the website's ItineraryCard (light), so both look identical and
 * never drift. Renders: day accordion → activities (priority/category/cost) →
 * choices carousel → accommodation tiers → transport.
 */

type Variant = 'light' | 'dark'

const VIEW = {
  light: {
    card: 'bg-white border-zen-black/10', optCard: 'bg-white border-zen-black/10',
    text: 'text-zen-black', textMuted: 'text-zen-black/60', textFaint: 'text-zen-black/50',
    chipInactive: 'bg-zen-black/5 text-zen-black/40', divider: 'border-zen-black/10', catIcon: 'text-zen-black/50',
    heroImg: 'object-cover brightness-90', heroGrad: 'bg-gradient-to-t from-zen-black/90 via-zen-black/40 to-transparent',
  },
  dark: {
    card: 'bg-[#0A0A0A] border-white/10', optCard: 'bg-white/5 border-white/10',
    text: 'text-briefing-cream', textMuted: 'text-briefing-cream/60', textFaint: 'text-briefing-cream/40',
    chipInactive: 'bg-white/5 text-briefing-cream/40', divider: 'border-white/5', catIcon: 'text-briefing-cream/50',
    heroImg: 'object-cover grayscale brightness-50', heroGrad: 'bg-gradient-to-t from-black via-black/40 to-transparent',
  },
} as const

type Tokens = (typeof VIEW)[Variant]

export interface ItineraryHero {
  image: string
  /** Optional gallery — when 2+ images, the hero becomes a swipeable carousel. */
  images?: string[]
  title: string
  subtitle: string
}

export default function ItineraryView({
  itinerary,
  variant = 'light',
  showJourneyHeader = true,
  hero,
  onClose,
}: {
  itinerary: AnyItinerary
  variant?: Variant
  showJourneyHeader?: boolean
  /** Optional hero photo header with the title overlaid (matches the LIFF look). */
  hero?: ItineraryHero
  /** When provided (and a hero is shown), renders a × in the hero's top-right corner. */
  onClose?: () => void
}) {
  const t = VIEW[variant]
  const [openDay, setOpenDay] = useState<number | null>(null) // all days collapsed by default
  // Normalize v1 OR v2 into the v1 render shape (lib/trips/itinerary-model.ts).
  const days = getRenderDays(itinerary)

  return (
    <div>
      {hero && (
        <div className="mb-8 relative overflow-hidden rounded-2xl h-60 sm:h-64 flex flex-col justify-end p-6 sm:p-8">
          {hero.images && hero.images.length > 1 ? (
            <HeroCarousel images={hero.images} alt={hero.title} imgClass={t.heroImg} />
          ) : (
            <Image src={hero.image} alt={hero.title} fill className={t.heroImg} sizes="(max-width: 640px) 100vw, 512px" />
          )}
          <div className={`absolute inset-0 pointer-events-none ${t.heroGrad}`} />
          {onClose && (
            <button
              onClick={onClose}
              aria-label="ปิด"
              className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-zen-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-zen-black/70 text-xl leading-none transition-colors"
            >
              &times;
            </button>
          )}
          <div className="relative z-10 pointer-events-none">
            <span className="text-basel-brick text-xs sm:text-sm font-bold uppercase tracking-[0.2em] mb-2 block">
              Travel Dossier
            </span>
            <h1 className="font-headline text-4xl sm:text-5xl font-extrabold tracking-tight text-briefing-cream leading-none">
              {hero.title}
            </h1>
            <p className="text-briefing-cream/70 text-sm sm:text-base mt-2 font-medium">{hero.subtitle}</p>
          </div>
        </div>
      )}

      {showJourneyHeader && (
        <div className="mb-6">
          <h2 className={`font-headline text-2xl font-extrabold ${t.text}`}>The Journey</h2>
        </div>
      )}

      <div className="space-y-4">
        {days.map((day) => (
          <DayCard
            key={day.day}
            day={day}
            isOpen={openDay === day.day}
            onToggle={() => setOpenDay(openDay === day.day ? null : day.day)}
            t={t}
            variant={variant}
          />
        ))}
      </div>
    </div>
  )
}

// ── Hero image carousel ─────────────────────────────────────────────────────
// IG-style swipeable cover gallery (same embla style as ChoiceCarousel). Fills
// the hero box; the gradient + title overlay sit on top (pointer-events-none so
// drags reach the carousel). Dots top-center; the close button stays top-right.
function HeroCarousel({ images, alt, imgClass }: { images: string[]; alt: string; imgClass: string }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'start' })
  const [idx, setIdx] = useState(0)
  const onSelect = useCallback(() => { if (emblaApi) setIdx(emblaApi.selectedScrollSnap()) }, [emblaApi])
  useEffect(() => {
    if (!emblaApi) return
    emblaApi.on('select', onSelect)
    return () => { emblaApi.off('select', onSelect) }
  }, [emblaApi, onSelect])

  return (
    <>
      <div className="absolute inset-0 overflow-hidden" ref={emblaRef}>
        <div className="flex h-full">
          {images.map((src, i) => (
            <div key={i} className="relative flex-[0_0_100%] h-full">
              <Image src={src} alt={`${alt} ${i + 1}`} fill className={imgClass} sizes="(max-width: 640px) 100vw, 512px" />
            </div>
          ))}
        </div>
      </div>
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
        {images.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => emblaApi?.scrollTo(i)}
            className={`rounded-full transition-all duration-200 ${i === idx ? 'w-2 h-2 bg-white' : 'w-1.5 h-1.5 bg-white/50 hover:bg-white/80'}`}
            aria-label={`Image ${i + 1}`}
          />
        ))}
      </div>
    </>
  )
}

// ── Day card ────────────────────────────────────────────────────────────────

function DayCard({ day, isOpen, onToggle, t, variant }: { day: Day; isOpen: boolean; onToggle: () => void; t: Tokens; variant: Variant }) {
  const paddedDay = String(day.day).padStart(2, '0')
  const mandatoryCount = day.activities.filter((a) => a.priority === 'mandatory').length
  const choiceCount = day.choices?.length ?? 0

  return (
    <div className={`border rounded-2xl overflow-hidden ${t.card}`}>
      <button className="w-full text-left px-6 py-5 flex items-center gap-4" onClick={onToggle}>
        <span
          className={[
            'inline-flex items-center justify-center w-12 h-12 rounded-xl font-black text-xl flex-shrink-0 transition-colors',
            isOpen ? 'bg-basel-brick text-briefing-cream' : t.chipInactive,
          ].join(' ')}
        >
          {paddedDay}
        </span>
        <div className="flex-1 min-w-0">
          <p className={`font-bold text-xl leading-tight truncate ${t.text}`}>{day.location}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
            <span className={`text-xs font-medium flex items-center gap-1 ${t.textFaint}`}>
              <MapPin size={11} strokeWidth={2.5} /> Day {day.day} · {day.activities.length} กิจกรรม
            </span>
            {day.free && (
              <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest flex items-center gap-0.5">
                <CalendarCheck size={10} strokeWidth={2.5} /> วันอิสระ
              </span>
            )}
            {mandatoryCount > 0 && (
              <span className="text-[10px] text-basel-brick font-medium flex items-center gap-0.5">
                <AlertTriangle size={10} strokeWidth={2.5} /> {mandatoryCount} must-do
              </span>
            )}
            {choiceCount > 0 && (
              <span className="text-[10px] text-blue-500 font-medium flex items-center gap-0.5">
                <Star size={10} strokeWidth={2.5} /> {choiceCount} choice{choiceCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <ChevronDown
          size={20}
          className={[
            'flex-shrink-0 transition-all duration-200',
            isOpen ? 'rotate-180 text-basel-brick' : `rotate-0 ${t.textFaint}`,
          ].join(' ')}
        />
      </button>

      {isOpen && (
        <div className={`px-6 pb-8 pt-2 space-y-8 border-t ${t.divider}`}>
          {day.free && day.activities.length === 0 && (!day.choices || day.choices.length === 0) && (
            <div className={`flex items-center gap-2.5 text-sm rounded-lg px-4 py-3 ${
              variant === 'dark' ? 'bg-white/5 text-briefing-cream/60' : 'bg-emerald-50 text-emerald-900'
            }`}>
              <CalendarCheck size={16} className="text-emerald-600 flex-shrink-0" strokeWidth={2.5} />
              <span>วันอิสระ — ยังไม่มีแผน เพิ่มกิจกรรมเองได้ที่ My Trip</span>
            </div>
          )}
          {day.activities.length > 0 && (
            <div className="space-y-6">
              {day.activities.map((act, idx) => (
                <ActivityItem key={idx} activity={act} t={t} />
              ))}
            </div>
          )}

          {day.choices && day.choices.length > 0 && (
            <div className="space-y-4">
              {day.choices.map((choice, idx) => (
                <ChoiceCarousel key={idx} choice={choice} variant={variant} />
              ))}
            </div>
          )}

          {(day.accommodation || (day.accommodationChoices && day.accommodationChoices.length > 0)) && (
            <div>
              <p className="text-xs font-bold text-basel-brick uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Hotel size={12} strokeWidth={2.5} /> ที่พัก
              </p>
              {day.accommodation && (
                <p className={`text-base leading-relaxed ${t.text}`}>{day.accommodation}</p>
              )}
              {day.accommodationChoices && day.accommodationChoices.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  <p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">ตัวเลือก · Options</p>
                  {day.accommodationChoices.map((opt, i) => (
                    <div key={i} className={`flex items-center gap-2 text-sm px-3 py-2 border rounded ${t.optCard} ${t.textMuted}`}>
                      <Circle size={8} className="text-blue-500 flex-shrink-0" fill="currentColor" />
                      <span className={`font-medium ${t.text}`}>{opt.name}</span>
                      {opt.tier && (
                        <span className={`text-[9px] font-bold uppercase tracking-widest ${t.textFaint}`}>{opt.tier}</span>
                      )}
                      {opt.cost && <span className="ml-auto text-xs text-basel-brick font-bold">{opt.cost}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {day.transport && (
            <div>
              <p className="text-xs font-bold text-basel-brick uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Train size={12} strokeWidth={2.5} /> การเดินทาง
              </p>
              <p className={`text-base leading-relaxed ${t.text}`}>{day.transport}</p>
              {day.transportNotes && (
                <p className={`text-xs mt-1 italic ${t.textFaint}`}>{day.transportNotes}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Activity item ─────────────────────────────────────────────────────────────

function ActivityItem({ activity, t }: { activity: Activity; t: Tokens }) {
  // Logistics step — a compact connector "how you move between activities".
  if (activity.isLogistics) {
    return (
      <div className={`relative pl-8 border-l-2 border-dashed ${t.divider}`}>
        <span className="absolute -left-[9px] top-0 w-[18px] h-[18px] rounded-full bg-zen-black/[0.06] flex items-center justify-center text-[10px] leading-none">
          {activity.emoji ?? '🚃'}
        </span>
        <div className={`flex items-center flex-wrap gap-x-2 gap-y-0.5 ${t.textMuted}`}>
          {activity.time && (
            <span className="text-[11px] font-bold text-basel-brick/80 flex items-center gap-0.5">
              <Clock size={10} strokeWidth={2.5} /> {activity.time}
            </span>
          )}
          <span className={`text-sm font-medium ${t.text}`}>{activity.name}</span>
          {activity.duration && (
            <span className={`text-[11px] flex items-center gap-0.5 ${t.textFaint}`}><Timer size={10} strokeWidth={2} /> {activity.duration}</span>
          )}
          {activity.cost && <span className="text-[11px] font-bold text-basel-brick">{activity.cost}</span>}
          {activity.mapUrl && (
            <a href={activity.mapUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-500 hover:underline flex items-center gap-0.5">
              <ExternalLink size={10} strokeWidth={2.5} /> Maps
            </a>
          )}
        </div>
        {activity.notes && <p className={`text-xs mt-0.5 leading-relaxed ${t.textFaint}`}>{activity.notes}</p>}
      </div>
    )
  }

  const priority = activity.priority ?? 'optional'
  return (
    <div className={`relative pl-8 border-l-[3px] ${priorityBorder(priority)}`}>
      <span className={`absolute -left-[6px] top-0.5 w-2.5 h-2.5 rounded-full ${priorityDot(priority)}`} />
      <div className="flex items-center gap-2 flex-wrap">
        {activity.time && (
          <p className="text-xs font-bold text-basel-brick uppercase tracking-widest flex items-center gap-1">
            <Clock size={10} strokeWidth={2.5} /> {activity.time}
          </p>
        )}
        {priority === 'mandatory' && (
          <span className="text-[8px] font-black uppercase tracking-widest bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
            {PRIORITY_LABEL.mandatory}
          </span>
        )}
        {priority === 'recommended' && (
          <span className="text-[8px] font-black uppercase tracking-widest bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
            {PRIORITY_LABEL.recommended}
          </span>
        )}
        {activity.emoji
          ? <span className="text-sm leading-none">{activity.emoji}</span>
          : activity.category && <CategoryIcon category={activity.category} size={13} className={t.catIcon} />}
      </div>
      <p className={`font-bold text-lg mt-1 ${t.text}`}>
        {activity.name}
        {activity.nameTh && <span className={`font-medium text-sm ml-2 ${t.textMuted}`}>{activity.nameTh}</span>}
      </p>
      {activity.notes && <p className={`text-base mt-1.5 leading-relaxed ${t.textMuted}`}>{activity.notes}</p>}
      {(activity.cost || activity.duration || activity.mapUrl) && (
        <div className="flex gap-3 mt-1.5 items-center">
          {activity.cost && (
            <span className={`text-[11px] font-bold flex items-center gap-0.5 ${t.textFaint}`}>
              <Banknote size={11} strokeWidth={2} /> {activity.cost}
            </span>
          )}
          {activity.duration && (
            <span className={`text-[11px] font-bold flex items-center gap-0.5 ${t.textFaint}`}>
              <Timer size={11} strokeWidth={2} /> {activity.duration}
            </span>
          )}
          {activity.mapUrl && (
            <a href={activity.mapUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold flex items-center gap-0.5 text-blue-500 hover:underline">
              <ExternalLink size={11} strokeWidth={2.5} /> Maps
            </a>
          )}
        </div>
      )}
    </div>
  )
}

function priorityBorder(p: ActivityPriority): string {
  switch (p) {
    case 'mandatory': return 'border-red-500'
    case 'recommended': return 'border-amber-400'
    default: return 'border-basel-brick'
  }
}
function priorityDot(p: ActivityPriority): string {
  switch (p) {
    case 'mandatory': return 'bg-red-500'
    case 'recommended': return 'bg-amber-400'
    default: return 'bg-basel-brick'
  }
}
