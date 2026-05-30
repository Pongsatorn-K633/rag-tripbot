'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence } from 'motion/react'
import { ChevronDown, X, Sun, Moon } from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import { IMG } from '@/lib/images'
import { evaluateTrip } from '@/lib/availability'
import { useLiffTheme, setLiffTheme } from '@/app/liff/theme'
import PlanCard, { type PlanTemplate } from '@/app/components/PlanCard'
import DateRangePicker from '@/app/components/DateRangePicker'

type EvaluatedPlan = { tpl: PlanTemplate; recommended: boolean }

const FLEX_CHIPS = [
  { value: 0, label: 'ตรงเป๊ะ', sub: 'Exact' },
  { value: 3, label: '±3 วัน', sub: '±3 days' },
  { value: 7, label: '±7 วัน', sub: '±7 days' },
  { value: 12, label: '±12 วัน', sub: '±12 days' },
]

const THEME = {
  light: {
    page: 'bg-briefing-cream', header: 'bg-briefing-cream/85 border-zen-black/10',
    panel: 'bg-white border-zen-black/10', text: 'text-zen-black', textMuted: 'text-zen-black/60',
    textFaint: 'text-zen-black/40', chipInactive: 'border-zen-black/20 text-zen-black',
    dashed: 'border-zen-black/10', sectionBorder: 'border-zen-black/5', skeleton: 'bg-white',
    skeletonBar: 'bg-zen-black/10', skeletonBar2: 'bg-zen-black/5',
    toggleBtn: 'border-zen-black/15 text-zen-black/60 hover:bg-zen-black/5',
  },
  dark: {
    page: 'bg-black', header: 'bg-black/85 border-white/5',
    panel: 'bg-white/[0.03] border-white/10', text: 'text-briefing-cream', textMuted: 'text-briefing-cream/60',
    textFaint: 'text-briefing-cream/40', chipInactive: 'border-white/15 text-briefing-cream',
    dashed: 'border-white/15', sectionBorder: 'border-white/10', skeleton: 'bg-white/[0.03]',
    skeletonBar: 'bg-white/10', skeletonBar2: 'bg-white/5',
    toggleBtn: 'border-white/15 text-briefing-cream/70 hover:bg-white/10',
  },
} as const

function addDaysDate(date: Date, n: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() + n)
  return d
}

/**
 * LINE LIFF version of /pre-planned — browse curated trips inside the LINE
 * in-app browser, filtered by travel dates. Light/dark theme toggle synced with
 * the LIFF itinerary page. Tapping a trip opens /liff/itinerary?shareCode=…
 */
export default function LiffPrePlannedPage() {
  const router = useRouter()
  const theme = useLiffTheme()
  const t = THEME[theme]
  const [templates, setTemplates] = useState<PlanTemplate[]>([])
  const [loading, setLoading] = useState(true)

  const [range, setRange] = useState<DateRange | undefined>()
  const [flex, setFlex] = useState(0)
  const [showHidden, setShowHidden] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/templates')
        if (!res.ok) throw new Error('Failed to load')
        const data = await res.json()
        setTemplates(data.templates ?? [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const startD = range?.from ?? null
  const endD = range?.to ?? range?.from ?? null
  const windowValid = !!startD
  const effStart = useMemo(() => (startD ? addDaysDate(startD, -flex) : null), [startD, flex])
  const effEnd = useMemo(() => (endD ? addDaysDate(endD, flex) : null), [endD, flex])

  const { matched, hidden } = useMemo(() => {
    if (!windowValid || !effStart || !effEnd) {
      return {
        matched: templates.map((tpl) => ({ tpl, recommended: false })) as EvaluatedPlan[],
        hidden: [] as PlanTemplate[],
      }
    }
    const matchedList: EvaluatedPlan[] = []
    const hiddenList: PlanTemplate[] = []
    for (const tpl of templates) {
      const { matches, recommended } = evaluateTrip(tpl.availability, effStart, effEnd, tpl.totalDays)
      if (matches) matchedList.push({ tpl, recommended })
      else hiddenList.push(tpl)
    }
    matchedList.sort((a, b) => Number(b.recommended) - Number(a.recommended))
    return { matched: matchedList, hidden: hiddenList }
  }, [templates, windowValid, effStart, effEnd])

  function openTrip(tpl: PlanTemplate) {
    if (tpl.shareCode) router.push(`/liff/itinerary?shareCode=${encodeURIComponent(tpl.shareCode)}`)
  }

  const filterActive = windowValid

  return (
    <div className={`min-h-screen font-sans ${t.page}`}>
      {/* Compact top bar */}
      <header className={`fixed top-0 w-full z-50 border-b backdrop-blur-md ${t.header}`}>
        <div className="flex items-center gap-2 px-5 py-1.5 max-w-lg mx-auto">
          <Image src={IMG.logo} alt="dopamichi logo" width={22} height={22} className="h-[22px] w-[22px] object-contain" />
          <span className={`font-headline font-bold tracking-tighter text-base ${t.text}`}>dopamichi</span>
          <button
            onClick={() => setLiffTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className={`ml-auto w-7 h-7 rounded-full flex items-center justify-center border transition-colors ${t.toggleBtn}`}
          >
            {theme === 'dark' ? <Sun size={14} strokeWidth={2.5} /> : <Moon size={14} strokeWidth={2.5} />}
          </button>
        </div>
      </header>

      <main className="pt-[52px] pb-16 px-4 max-w-lg mx-auto">
        {/* Title */}
        <header className="mb-6">
          <h1 className="text-3xl font-headline font-extrabold tracking-tighter text-basel-brick mb-2">
            แพลนพร้อมเที่ยว
          </h1>
          <p className={`text-sm font-sans leading-relaxed ${t.textMuted}`}>
            เลือกช่วงวันเดินทาง แล้วดูเฉพาะแพลนที่เที่ยวได้จริงในช่วงนั้น — แตะเพื่อดูแผนเต็ม
          </p>
        </header>

        {/* Date filter */}
        <div className={`border shadow-sm p-4 mb-8 ${t.panel}`}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className={`font-headline font-black text-xs uppercase tracking-[0.15em] ${t.text}`}>
              กรองตามวันเดินทาง
            </h2>
            {filterActive && (
              <button
                onClick={() => { setRange(undefined); setShowHidden(false) }}
                className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest hover:text-basel-brick transition-colors ${t.textFaint}`}
              >
                <X size={12} strokeWidth={3} /> ล้าง
              </button>
            )}
          </div>

          <DateRangePicker value={range} onChange={setRange} variant={theme} />

          <div className="flex gap-2 mt-3">
            {FLEX_CHIPS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFlex(opt.value)}
                title={opt.sub}
                className={`px-2 py-2 border text-center transition-all flex-1 ${
                  flex === opt.value
                    ? 'border-basel-brick bg-basel-brick text-white'
                    : `${t.chipInactive} hover:border-basel-brick`
                }`}
              >
                <span className="block font-headline font-black text-[11px] tracking-tight whitespace-nowrap">
                  {opt.label}
                </span>
              </button>
            ))}
          </div>

          {filterActive && flex > 0 && effStart && effEnd && (
            <p className={`text-[10px] mt-2 ${t.textFaint}`}>
              ค้นหาในช่วง ±{flex} วัน: {effStart.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} –{' '}
              {effEnd.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
            </p>
          )}
        </div>

        {/* Section header */}
        <div className={`mb-6 border-b-2 pb-4 ${t.sectionBorder}`}>
          <span className="text-basel-brick font-extrabold text-[11px] uppercase tracking-[0.3em] mb-1 block font-headline">
            {filterActive ? `Matching your dates · ${matched.length}` : 'All pre-planned trips'}
          </span>
          <h2 className={`text-lg font-headline font-black tracking-tighter ${t.text}`}>
            {filterActive ? 'คัดมาให้ตรงกับช่วงเวลาเดินทางของคุณ' : 'แพลนพร้อมเที่ยวทั้งหมด'}
          </h2>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="space-y-6">
            {[0, 1].map((i) => (
              <div key={i} className={`p-4 rounded-xl animate-pulse ${t.skeleton}`}>
                <div className={`aspect-[4/5] rounded-lg mb-4 ${t.skeletonBar2}`} />
                <div className={`h-5 rounded mb-2 ${t.skeletonBar}`} />
                <div className={`h-3 rounded w-3/4 ${t.skeletonBar2}`} />
              </div>
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className={`border-2 border-dashed rounded-xl p-12 text-center ${t.dashed}`}>
            <p className={`font-sans ${t.textFaint}`}>ยังไม่มีแพลนในขณะนี้</p>
          </div>
        ) : matched.length === 0 ? (
          <div className={`border-2 border-dashed rounded-xl p-12 text-center ${t.dashed}`}>
            <p className={`font-sans mb-1 ${t.textMuted}`}>ไม่มีแพลนที่เที่ยวได้ในช่วงวันที่เลือก</p>
            <p className={`font-sans text-sm ${t.textFaint}`}>ลองขยายช่วงวันหรือเพิ่มความยืดหยุ่น</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {matched.map(({ tpl, recommended }) => (
              <PlanCard key={tpl.id} tpl={tpl} recommended={recommended} variant={theme} onOpen={() => openTrip(tpl)} />
            ))}
          </div>
        )}

        {/* Hidden (out-of-season) trips */}
        {filterActive && hidden.length > 0 && (
          <div className="mt-8">
            <button
              onClick={() => setShowHidden(!showHidden)}
              className={`text-[11px] font-black uppercase tracking-widest hover:text-basel-brick transition-colors inline-flex items-center gap-2 ${t.textFaint}`}
            >
              <ChevronDown size={14} className={`transition-transform ${showHidden ? 'rotate-180' : ''}`} />
              {showHidden ? 'ซ่อน' : 'แสดง'} {hidden.length} แพลนที่ไม่ตรงช่วงนี้
            </button>
            <AnimatePresence initial={false}>
              {showHidden && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
                    {hidden.map((tpl) => (
                      <PlanCard key={tpl.id} tpl={tpl} dimmed variant={theme} onOpen={() => openTrip(tpl)} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  )
}
