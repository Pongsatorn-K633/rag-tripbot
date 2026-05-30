'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { useLiffTheme, setLiffTheme, type LiffTheme } from '@/app/liff/theme'
import Image from 'next/image'
import {
  ChevronDown, Sun, Moon, Clock, Hotel, Train, Banknote, Timer,
  AlertTriangle, Star, Circle, MapPin,
} from 'lucide-react'
import { IMG } from '@/lib/images'
import type { Itinerary, Day, Activity, ActivityPriority } from '@/lib/itinerary-types'
import { PRIORITY_LABEL } from '@/lib/itinerary-types'
import CategoryIcon from '@/app/components/CategoryIcon'
import ChoiceCarousel from '@/app/components/ChoiceCarousel'

// ── Theme tokens ──────────────────────────────────────────────────────────────
// Dark is the original look (default, kept because it's lovely); light matches
// the website palette (briefing-cream / zen-black / basel-brick accent shared).

type Theme = LiffTheme

const THEME = {
  dark: {
    page: 'bg-black',
    header: 'bg-black/85 border-white/5',
    card: 'bg-[#0A0A0A] border-white/10',
    optCard: 'bg-white/5 border-white/10',
    text: 'text-briefing-cream',
    textMuted: 'text-briefing-cream/60',
    textFaint: 'text-briefing-cream/40',
    chipInactive: 'bg-white/5 text-briefing-cream/40',
    divider: 'border-white/5',
    heroImg: 'object-cover grayscale brightness-50',
    heroGrad: 'bg-gradient-to-t from-black via-black/40 to-transparent',
    catIcon: 'text-briefing-cream/50',
  },
  light: {
    page: 'bg-briefing-cream',
    header: 'bg-briefing-cream/85 border-zen-black/10',
    card: 'bg-white border-zen-black/10',
    optCard: 'bg-white border-zen-black/10',
    text: 'text-zen-black',
    textMuted: 'text-zen-black/60',
    textFaint: 'text-zen-black/50',
    chipInactive: 'bg-zen-black/5 text-zen-black/40',
    divider: 'border-zen-black/10',
    heroImg: 'object-cover brightness-90',
    heroGrad: 'bg-gradient-to-t from-zen-black/90 via-zen-black/40 to-transparent',
    catIcon: 'text-zen-black/50',
  },
} as const

function ItineraryContent() {
  const searchParams = useSearchParams()
  // LIFF wraps query params in liff.state — parse it to extract shareCode
  let shareCode = searchParams.get('shareCode')
  if (!shareCode) {
    const liffState = searchParams.get('liff.state')
    if (liffState) {
      const stateParams = new URLSearchParams(liffState.replace(/^\?/, ''))
      shareCode = stateParams.get('shareCode')
    }
  }
  const [itinerary, setItinerary] = useState<Itinerary | null>(null)
  const [tripStartDate, setTripStartDate] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(() => Boolean(shareCode))
  const [error, setError] = useState<string | null>(() =>
    shareCode ? null : 'ไม่พบรหัสแผนการเดินทาง',
  )
  const [openDay, setOpenDay] = useState<number | null>(1)
  const theme = useLiffTheme()

  function toggleTheme() {
    setLiffTheme(theme === 'dark' ? 'light' : 'dark')
  }

  const t = THEME[theme]

  useEffect(() => {
    if (!shareCode) return
    fetch(`/api/trips/by-code?shareCode=${encodeURIComponent(shareCode)}`)
      .then((res) => {
        if (!res.ok) throw new Error('ไม่พบแผนการเดินทาง')
        return res.json()
      })
      .then((data) => {
        setItinerary(data.itinerary)
        setTripStartDate(data.startDate ?? null)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [shareCode])

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${t.page}`}>
        <p className={`${t.textMuted} font-sans text-base`}>กำลังโหลดแผนการเดินทาง...</p>
      </div>
    )
  }

  if (error || !itinerary) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${t.page}`}>
        <p className="text-red-400 font-sans text-base">{error ?? 'เกิดข้อผิดพลาด'}</p>
      </div>
    )
  }

  const totalDays = itinerary.totalDays ?? itinerary.days.length
  const firstDayLocation = itinerary.days[0]?.location ?? ''
  const currentOpenDay = openDay ?? 1

  const heroSubtitle = (() => {
    if (tripStartDate) {
      const start = new Date(tripStartDate)
      const end = new Date(tripStartDate)
      end.setDate(end.getDate() + totalDays - 1)
      const fmt = (d: Date) => d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
      return `${fmt(start)} – ${fmt(end)} • ${firstDayLocation}`
    }
    return `${totalDays} วัน • ${firstDayLocation}`
  })()

  return (
    <div className={`min-h-screen font-sans ${t.page}`}>
      {/* Top bar — compact (~half height) */}
      <header className={`fixed top-0 w-full z-50 border-b backdrop-blur-md ${t.header}`}>
        <div className="flex items-center gap-2 px-5 py-1.5 max-w-lg mx-auto">
          <Image src={IMG.logo} alt="dopamichi logo" width={22} height={22} className="h-[22px] w-[22px] object-contain" />
          <span className={`font-headline font-bold tracking-tighter text-base ${t.text}`}>dopamichi</span>
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className={`ml-auto w-7 h-7 rounded-full flex items-center justify-center border transition-colors ${
              theme === 'dark'
                ? 'border-white/15 text-briefing-cream/70 hover:bg-white/10'
                : 'border-zen-black/15 text-zen-black/60 hover:bg-zen-black/5'
            }`}
          >
            {theme === 'dark' ? <Sun size={14} strokeWidth={2.5} /> : <Moon size={14} strokeWidth={2.5} />}
          </button>
        </div>
      </header>

      {/* Main content — offset for fixed (compact) top bar */}
      <main className="pt-[44px] pb-16 px-4 max-w-lg mx-auto">
        {/* Hero section */}
        <div className="mb-10 relative overflow-hidden rounded-2xl h-72 flex flex-col justify-end p-8">
          <Image src={IMG.liffHero} alt="Japan scenery" fill className={t.heroImg} sizes="100vw" />
          <div className={`absolute inset-0 ${t.heroGrad}`} />
          <div className="relative z-10">
            <span className="text-basel-brick text-sm font-bold uppercase tracking-[0.2em] mb-3 block">
              Travel Dossier
            </span>
            <h1 className="font-headline text-5xl font-extrabold tracking-tight text-briefing-cream leading-none">
              {itinerary.title ?? 'แผนการเดินทาง'}
            </h1>
            <p className="text-briefing-cream/60 text-base mt-2 font-medium">{heroSubtitle}</p>
          </div>
        </div>

        {/* The Journey section */}
        <div>
          <div className="flex items-baseline justify-between mb-6">
            <h2 className={`font-headline text-2xl font-extrabold ${t.text}`}>The Journey</h2>
            <span className="text-xs font-bold text-basel-brick uppercase tracking-widest">
              Day {currentOpenDay} / {totalDays}
            </span>
          </div>

          <div className="space-y-4">
            {itinerary.days.map((day) => (
              <DayCard
                key={day.day}
                day={day}
                isOpen={openDay === day.day}
                onToggle={() => setOpenDay(openDay === day.day ? null : day.day)}
                t={t}
                theme={theme}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

type Tokens = typeof THEME[Theme]

// ── Day card ────────────────────────────────────────────────────────────────

function DayCard({ day, isOpen, onToggle, t, theme }: { day: Day; isOpen: boolean; onToggle: () => void; t: Tokens; theme: Theme }) {
  const paddedDay = String(day.day).padStart(2, '0')
  const mandatoryCount = day.activities.filter((a) => a.priority === 'mandatory').length
  const choiceCount = day.choices?.length ?? 0

  return (
    <div className={`border rounded-2xl overflow-hidden ${t.card}`}>
      {/* Summary row */}
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

      {/* Expanded panel */}
      {isOpen && (
        <div className={`px-6 pb-8 pt-2 space-y-8 border-t ${t.divider}`}>
          {/* Activities timeline */}
          {day.activities.length > 0 && (
            <div className="space-y-6">
              {day.activities.map((act, idx) => (
                <ActivityItem key={idx} activity={act} t={t} />
              ))}
            </div>
          )}

          {/* Choices — swipeable carousel (same as the website) */}
          {day.choices && day.choices.length > 0 && (
            <div className="space-y-4">
              {day.choices.map((choice, idx) => (
                <ChoiceCarousel key={idx} choice={choice} variant={theme} />
              ))}
            </div>
          )}

          {/* Accommodation */}
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

          {/* Transport */}
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
  const priority = activity.priority ?? 'optional'
  return (
    <div className={`relative pl-8 border-l-[3px] ${priorityBorder(priority)}`}>
      <span className={`absolute -left-[6px] top-0.5 w-2.5 h-2.5 rounded-full ${priorityDot(priority)}`} />
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs font-bold text-basel-brick uppercase tracking-widest flex items-center gap-1">
          <Clock size={10} strokeWidth={2.5} /> {activity.time}
        </p>
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
        {activity.category && <CategoryIcon category={activity.category} size={13} className={t.catIcon} />}
      </div>
      <p className={`font-bold text-lg mt-1 ${t.text}`}>{activity.name}</p>
      {activity.notes && <p className={`text-base mt-1.5 leading-relaxed ${t.textMuted}`}>{activity.notes}</p>}
      {(activity.cost || activity.duration) && (
        <div className="flex gap-3 mt-1.5">
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
        </div>
      )}
    </div>
  )
}

// ── Priority colors (theme-independent) ──────────────────────────────────────

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

export default function LiffItineraryPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-briefing-cream">
          <p className="text-zen-black/50 font-sans text-base">กำลังโหลด...</p>
        </div>
      }
    >
      <ItineraryContent />
    </Suspense>
  )
}
