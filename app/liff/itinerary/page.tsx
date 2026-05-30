'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { useLiffTheme, setLiffTheme, type LiffTheme } from '@/app/liff/theme'
import Image from 'next/image'
import { Sun, Moon } from 'lucide-react'
import { IMG } from '@/lib/images'
import type { Itinerary } from '@/lib/itinerary-types'
import ItineraryView from '@/app/components/ItineraryView'

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
        {/* Hero + journey — shared renderer (identical to the website) */}
        <ItineraryView
          itinerary={itinerary}
          variant={theme}
          hero={{ image: IMG.liffHero, title: itinerary.title ?? 'แผนการเดินทาง', subtitle: heroSubtitle }}
        />
      </main>
    </div>
  )
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
