'use client'

import { useState, useCallback, useEffect, type ReactNode } from 'react'
import Image from 'next/image'
import useEmblaCarousel from 'embla-carousel-react'
import {
  ChevronDown, MapPin, AlertTriangle, Star, Hotel, Train, Clock, Banknote, Timer, Circle, CalendarCheck,
  ExternalLink, Globe, Footprints, Sparkles,
} from 'lucide-react'
import type { AnyItinerary, Day, Activity, ActivityPriority, ItineraryV3, HighlightV3 } from '@/lib/itinerary-types'
import { PRIORITY_LABEL } from '@/lib/itinerary-types'
import { getRenderDays, isV3, type RenderLang } from '@/lib/trips/itinerary-model'
import { resolveCoverImage } from '@/lib/cover-image'
import { safeHref } from '@/lib/url'
import QueueBookingBadge from '@/app/components/QueueBookingBadge'
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
  onMakeDayFree,
  makeDayFreeLabel,
  sections = 'all',
}: {
  itinerary: AnyItinerary
  variant?: Variant
  showJourneyHeader?: boolean
  /** Optional hero photo header with the title overlaid (matches the LIFF look). */
  hero?: ItineraryHero
  /** When provided (and a hero is shown), renders a × in the hero's top-right corner. */
  onClose?: () => void
  /** When set, a flagged day (late arrival) shows a "make Day 1 free" action. */
  onMakeDayFree?: () => void
  /** Case-specific label for that action (shift vs replace). */
  makeDayFreeLabel?: string
  /** Which chunk to render — 'overview' (description/highlights/guides) or
   *  'days' (the day cards) for the fullscreen preview's tabs; 'all' = both. */
  sections?: 'all' | 'overview' | 'days'
}) {
  const t = VIEW[variant]
  // Multiple days can be open at once; toggling one never collapses the others.
  const [openDays, setOpenDays] = useState<Set<number>>(new Set())
  const toggleDay = (d: number) =>
    setOpenDays((prev) => {
      const next = new Set(prev)
      next.has(d) ? next.delete(d) : next.add(d)
      return next
    })
  // EN/TH toggle (v3 only — it has bilingual fields).
  const [lang, setLang] = useState<RenderLang>('th')
  // Normalize v1 OR v2 OR v3 into the v1 render shape (lib/trips/itinerary-model.ts).
  const days = getRenderDays(itinerary, lang)
  // V3 trips carry extra trip-level content (full description, highlights, guides).
  const v3 = isV3(itinerary) ? itinerary : null
  const description = v3?.overview.description ?? (itinerary as { description?: string }).description
  const highlights = v3?.highlights ?? []
  const guides = v3 ? collectGuides(v3, lang) : []

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

      {v3 && (
        <div className="flex justify-end mb-4">
          <div className="inline-flex rounded-lg border border-zen-black/15 overflow-hidden text-[11px] font-black">
            {(['th', 'en'] as const).map((lg) => (
              <button key={lg} onClick={() => setLang(lg)}
                className={`px-3 py-1.5 uppercase tracking-widest transition-colors ${lang === lg ? 'bg-basel-brick text-white' : `${t.text} hover:bg-zen-black/5`}`}>
                {lg}
              </button>
            ))}
          </div>
        </div>
      )}

      {sections !== 'days' && description && (
        <p className={`text-sm leading-relaxed mb-6 whitespace-pre-line ${t.textMuted}`}>{description}</p>
      )}

      {sections !== 'days' && highlights.length > 0 && <HighlightsStrip highlights={highlights} t={t} />}

      {sections !== 'overview' && (
        <>
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
                isOpen={openDays.has(day.day)}
                onToggle={() => toggleDay(day.day)}
                t={t}
                variant={variant}
                onMakeDayFree={onMakeDayFree}
                makeDayFreeLabel={makeDayFreeLabel}
              />
            ))}
          </div>
        </>
      )}

      {sections !== 'days' && guides.length > 0 && <GuidesAccordion guides={guides} t={t} variant={variant} />}
    </div>
  )
}

// ── Highlights carousel (V3) ─────────────────────────────────────────────────
// Swipeable must-see places with their level (😍 / ⭐ / 👌). Photos are mocked
// (gradient + emoji) for now — swap the placeholder block for an <Image> later.
const MOCK_GRADIENT = [
  'bg-gradient-to-br from-rose-200 to-orange-200',
  'bg-gradient-to-br from-sky-200 to-indigo-200',
  'bg-gradient-to-br from-emerald-200 to-teal-200',
  'bg-gradient-to-br from-amber-200 to-yellow-200',
  'bg-gradient-to-br from-fuchsia-200 to-purple-200',
  'bg-gradient-to-br from-cyan-200 to-blue-200',
]

function HighlightsStrip({ highlights, t }: { highlights: HighlightV3[]; t: Tokens }) {
  const [emblaRef] = useEmblaCarousel({ align: 'start', dragFree: true })
  return (
    <div className="mb-8">
      <p className="text-xs font-bold text-basel-brick uppercase tracking-widest mb-3 flex items-center gap-1.5">
        <Sparkles size={13} strokeWidth={2.5} /> ไฮไลต์ทริป · Highlights
      </p>
      <div className="overflow-hidden -mx-1" ref={emblaRef}>
        <div className="flex gap-3 px-1">
          {highlights.map((h, i) => (
            <div key={i} className={`flex-[0_0_72%] sm:flex-[0_0_46%] min-w-0 border rounded-xl overflow-hidden ${t.card}`}>
              {/* photo (real if set, else a gradient placeholder) */}
              {h.image ? (
                <div className="relative h-24">
                  <Image src={resolveCoverImage(h.image, h.name)} alt={h.name} fill className="object-cover" sizes="(max-width: 640px) 72vw, 240px" />
                  <span className="absolute top-1.5 right-2 text-base leading-none drop-shadow">{h.level || '⭐'}</span>
                </div>
              ) : (
                <div className={`relative h-24 flex items-center justify-center ${MOCK_GRADIENT[i % MOCK_GRADIENT.length]}`}>
                  <span className="text-3xl opacity-90 leading-none">{h.level || '📍'}</span>
                </div>
              )}
              <div className="px-3 py-2.5">
                <p className={`font-bold text-sm ${t.text}`}>{h.name}</p>
                {h.description && <p className={`text-xs leading-relaxed mt-0.5 line-clamp-3 ${t.textMuted}`}>{h.description}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Guides accordion (V3) ────────────────────────────────────────────────────
// Bilingual trip-level guides (logistics / food / accommodation / queue / remark).
interface Guide { key: string; label: string; emoji: string; text: string }
function collectGuides(v3: ItineraryV3, lang: RenderLang): Guide[] {
  const o = v3.overview
  const pick = (en?: string, th?: string) => ((lang === 'en' ? en || th : th || en) || '').trim()
  const defs: Guide[] = [
    { key: 'logistic', label: 'การเดินทาง · Logistics', emoji: '🚆', text: pick(o.logistic_guide_en, o.logistic_guide_th) },
    { key: 'food', label: 'อาหาร · Food', emoji: '🍜', text: pick(o.food_guide_en, o.food_guide_th) },
    { key: 'accommodation', label: 'ที่พัก · Stay', emoji: '🏨', text: pick(o.accommodation_guide_en, o.accommodation_guide_th) },
    { key: 'queue', label: 'คิว · Queues', emoji: '⏳', text: pick(o.queue_guide_en, o.queue_guide_th) },
    { key: 'remark', label: 'หมายเหตุ · Notes', emoji: '📌', text: pick(o.remark_en, o.remark_th) },
  ]
  return defs.filter((g) => g.text)
}

function GuidesAccordion({ guides, t, variant }: { guides: Guide[]; t: Tokens; variant: Variant }) {
  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggle = (k: string) => setOpen((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n })
  return (
    <div className="mt-8">
      <p className="text-xs font-bold text-basel-brick uppercase tracking-widest mb-3 flex items-center gap-1.5">
        <Sparkles size={13} strokeWidth={2.5} /> คู่มือทริป · Trip guides
      </p>
      <div className="space-y-2">
        {guides.map((g) => {
          const isOpen = open.has(g.key)
          return (
            <div key={g.key} className={`border rounded-xl overflow-hidden ${t.card}`}>
              <button onClick={() => toggle(g.key)} className="w-full text-left px-4 py-3 flex items-center gap-2.5">
                <span className="text-base leading-none">{g.emoji}</span>
                <span className={`flex-1 font-bold text-sm ${t.text}`}>{g.label}</span>
                <ChevronDown size={16} className={`flex-shrink-0 transition-transform ${isOpen ? 'rotate-180 text-basel-brick' : t.textFaint}`} />
              </button>
              {isOpen && (
                <p className={`px-4 pb-4 pt-1 text-sm leading-relaxed whitespace-pre-line border-t ${t.divider} ${t.textMuted}`}>{g.text}</p>
              )}
            </div>
          )
        })}
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

function DayCard({ day, isOpen, onToggle, t, variant, onMakeDayFree, makeDayFreeLabel }: { day: Day; isOpen: boolean; onToggle: () => void; t: Tokens; variant: Variant; onMakeDayFree?: () => void; makeDayFreeLabel?: string }) {
  const paddedDay = String(day.day).padStart(2, '0')
  const mandatoryCount = day.activities.filter((a) => a.priority === 'mandatory').length
  const choiceCount = day.choices?.length ?? 0
  // Interleave activities + choices by time so choosable slots sit in their real
  // place in the day instead of being dumped at the bottom. Untimed → end.
  const timeline = [
    ...day.activities.map((a) => ({ kind: 'act' as const, time: a.time, el: a })),
    ...(day.choices ?? []).map((c) => ({ kind: 'choice' as const, time: c.time, el: c })),
  ].sort((a, b) => cmpTime(a.time, b.time))
  const itemCount = timeline.length

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
              <MapPin size={11} strokeWidth={2.5} /> Day {day.day} · {itemCount} กิจกรรม
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
            {day.notice && (
              <span className="text-[10px] text-amber-600 font-bold flex items-center gap-0.5">
                <AlertTriangle size={10} strokeWidth={2.5} /> ปรับเวลา
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
          {day.notice && (
            <div className={`flex items-start gap-2.5 text-[13px] leading-relaxed rounded-lg px-4 py-3 ${
              variant === 'dark'
                ? 'bg-amber-500/10 border border-amber-500/30 text-amber-200'
                : 'bg-amber-50 border border-amber-300 text-amber-900'
            }`}>
              <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
              <div className="flex-1 space-y-2">
                <span className="block">{day.notice}</span>
                {onMakeDayFree && (
                  <button
                    onClick={onMakeDayFree}
                    className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors"
                  >
                    <CalendarCheck size={12} strokeWidth={2.5} /> {makeDayFreeLabel ?? 'ปรับวันแรก'}
                  </button>
                )}
              </div>
            </div>
          )}
          {day.free && day.activities.length === 0 && (!day.choices || day.choices.length === 0) && (
            <div className={`flex items-center gap-2.5 text-sm rounded-lg px-4 py-3 ${
              variant === 'dark' ? 'bg-white/5 text-briefing-cream/60' : 'bg-emerald-50 text-emerald-900'
            }`}>
              <CalendarCheck size={16} className="text-emerald-600 flex-shrink-0" strokeWidth={2.5} />
              <span>วันอิสระ — ยังไม่มีแผน เพิ่มกิจกรรมเองได้ที่ My Trip</span>
            </div>
          )}
          {timeline.length > 0 && (
            <div className="space-y-6">
              {timeline.map((it, idx) =>
                it.kind === 'act'
                  ? <ActivityItem key={idx} activity={it.el} t={t} variant={variant} />
                  : <ChoiceCarousel key={idx} choice={it.el} variant={variant} />
              )}
            </div>
          )}

          {(day.accommodation || (day.accommodationChoices && day.accommodationChoices.length > 0)) && (
            <div>
              <p className="text-xs font-bold text-basel-brick uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Hotel size={12} strokeWidth={2.5} /> ที่พัก
              </p>
              {day.accommodation && (
                <p className={`font-bold text-sm leading-relaxed ${t.text}`}>{day.accommodation}</p>
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

function ActivityItem({ activity, t, variant }: { activity: Activity; t: Tokens; variant: Variant }) {
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
          <span className={`text-sm font-bold ${t.text}`}>{activity.name}</span>
          {activity.duration && (
            <span className={`text-[11px] flex items-center gap-0.5 ${t.textFaint}`}><Timer size={10} strokeWidth={2} /> {activity.duration}</span>
          )}
          {activity.cost && <span className="text-[11px] font-bold text-basel-brick">{activity.cost}</span>}
          {safeHref(activity.mapUrl) && (
            <a href={safeHref(activity.mapUrl)} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-500 hover:underline flex items-center gap-0.5">
              <ExternalLink size={10} strokeWidth={2.5} /> Maps
            </a>
          )}
        </div>
        {activity.notes && <p className={`text-sm mt-1 leading-relaxed ${t.textMuted}`}>{activity.notes}</p>}
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
      <p className={`font-bold text-sm mt-1 ${t.text}`}>
        {activity.name}
        {activity.nameTh && <span className={`font-medium text-xs ml-2 ${t.textMuted}`}>{activity.nameTh}</span>}
      </p>

      {(activity.location || activity.rating != null || activity.operatingHours) && (
        <div className={`flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] ${t.textFaint}`}>
          {activity.location && <span className="flex items-center gap-0.5"><MapPin size={10} strokeWidth={2.5} /> {activity.location}</span>}
          {activity.rating != null && <span className="flex items-center gap-0.5 text-amber-500 font-bold"><Star size={10} strokeWidth={2.5} fill="currentColor" /> {activity.rating}</span>}
          {activity.operatingHours && <span className="flex items-center gap-0.5"><Clock size={10} strokeWidth={2} /> {activity.operatingHours}</span>}
        </div>
      )}

      {activity.notes && <p className={`text-sm mt-1 leading-relaxed ${t.textMuted}`}>{activity.notes}</p>}

      {activity.remark && (
        <div className={`flex items-start gap-1.5 text-xs mt-1.5 leading-relaxed rounded-lg px-2.5 py-1.5 ${
          variant === 'dark' ? 'bg-amber-500/10 text-amber-200' : 'bg-amber-50 text-amber-900'
        }`}>
          <AlertTriangle size={12} className="text-amber-600 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
          <span>{activity.remark}</span>
        </div>
      )}

      <QueueBookingBadge queue={activity.queueTime} booking={activity.bookingPolicy} howToBook={activity.howToBook} variant={variant} />

      {(activity.cost || activity.duration || activity.mapUrl || activity.walkingUrl || hasSocial(activity.social)) && (
        <div className="flex gap-x-3 gap-y-1 mt-1.5 items-center flex-wrap">
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
          {activity.mapUrl && <LinkPill href={activity.mapUrl} icon={<ExternalLink size={11} strokeWidth={2.5} />} label="Maps" />}
          {activity.walkingUrl && <LinkPill href={activity.walkingUrl} icon={<Footprints size={11} strokeWidth={2.5} />} label="เส้นทางเดิน" />}
          {activity.social?.website && <LinkPill href={activity.social.website} icon={<Globe size={11} strokeWidth={2.5} />} label="Website" />}
          {activity.social?.ig && <LinkPill href={activity.social.ig} label="IG" />}
          {activity.social?.fb && <LinkPill href={activity.social.fb} label="FB" />}
          {activity.social?.tt && <LinkPill href={activity.social.tt} label="TikTok" />}
        </div>
      )}
    </div>
  )
}

// ── Activity sub-pieces ──────────────────────────────────────────────────────

function hasSocial(s?: Activity['social']): boolean {
  return !!s && !!(s.ig || s.fb || s.tt || s.website)
}

function LinkPill({ href, icon, label }: { href: string; icon?: ReactNode; label: string }) {
  const safe = safeHref(href)
  if (!safe) return null // drop javascript:/data:/garbage links
  return (
    <a href={safe} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold flex items-center gap-0.5 text-blue-500 hover:underline">
      {icon} {label}
    </a>
  )
}

// Sort by HH:MM ascending; items without a time fall to the end.
function cmpTime(a?: string, b?: string): number {
  const ta = (a ?? '').trim(), tb = (b ?? '').trim()
  if (ta && tb) return ta.localeCompare(tb)
  if (ta) return -1
  if (tb) return 1
  return 0
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
