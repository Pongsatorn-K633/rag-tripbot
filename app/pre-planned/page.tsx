'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ChevronDown, X } from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import { evaluateTrip } from '@/lib/availability'
import { useSavedTemplates } from '@/app/hooks/useSavedTemplates'
import PlanCard, { type PlanTemplate } from '@/app/components/PlanCard'
import PlanPreviewModal from '@/app/components/PlanPreviewModal'
import DateRangePicker from '@/app/components/DateRangePicker'

type EvaluatedPlan = { tpl: PlanTemplate; recommended: boolean; perfectFit: boolean }

// ± flex widens the picked window by N days on EACH side, e.g. 17–25 Oct + ±3
// searches 14–28 Oct. Default ตรงเป๊ะ (0).
const FLEX_CHIPS = [
  { value: 0, label: 'ตรงเป๊ะ', sub: 'Exact' },
  { value: 3, label: '±3 วัน', sub: '±3 days' },
  { value: 7, label: '±7 วัน', sub: '±7 days' },
  { value: 12, label: '±12 วัน', sub: '±12 days' },
]

function addDaysDate(date: Date, n: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() + n)
  return d
}

// Inclusive day count between two dates (17→20 Oct = 4 days), midnight-normalized.
function dayCount(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime()
  return Math.round((b - a) / 86_400_000) + 1
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function PrePlannedPage() {
  const [templates, setTemplates] = useState<PlanTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const { savedIds, pending, toggleHeart } = useSavedTemplates('/pre-planned')

  // ── Optional date filter ──────────────────────────────────────────────────────
  const [range, setRange] = useState<DateRange | undefined>()
  const [flex, setFlex] = useState(0) // default ตรงเป๊ะ (exact window)
  const [showHidden, setShowHidden] = useState(false)

  // Modal
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedTemplate = selectedId ? templates.find((t) => t.id === selectedId) ?? null : null

  // ── Fetch templates on mount ────────────────────────────────────────────────
  useEffect(() => {
    async function loadTemplates() {
      try {
        const res = await fetch('/api/templates')
        if (!res.ok) throw new Error('Failed to load templates')
        const data = await res.json()
        setTemplates(data.templates ?? [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadTemplates()
  }, [])

  // ── Filtering ────────────────────────────────────────────────────────────────
  // A single picked day = a one-day window (to falls back to from); ±flex widens.
  const startD = range?.from ?? null
  const endD = range?.to ?? range?.from ?? null
  const windowValid = !!startD
  const effStart = useMemo(() => (startD ? addDaysDate(startD, -flex) : null), [startD, flex])
  const effEnd = useMemo(() => (endD ? addDaysDate(endD, flex) : null), [endD, flex])
  // "Perfect fit" compares the RAW picked window (not flex-widened) against trip
  // length: same number of days = this plan fills the user's dates exactly.
  const pickedDays = useMemo(
    () => (startD && endD ? dayCount(startD, endD) : null),
    [startD, endD]
  )

  const { matched, hidden } = useMemo(() => {
    if (!windowValid || !effStart || !effEnd) {
      return {
        matched: templates.map((t) => ({ tpl: t, recommended: false, perfectFit: false })) as EvaluatedPlan[],
        hidden: [] as PlanTemplate[],
      }
    }
    const matchedList: EvaluatedPlan[] = []
    const hiddenList: PlanTemplate[] = []
    for (const tpl of templates) {
      const { matches, recommended } = evaluateTrip(tpl.availability, effStart, effEnd, tpl.totalDays)
      if (matches) matchedList.push({ tpl, recommended, perfectFit: pickedDays === tpl.totalDays })
      else hiddenList.push(tpl)
    }
    // Perfect-fit first, then recommended, then the rest.
    matchedList.sort(
      (a, b) =>
        Number(b.perfectFit) - Number(a.perfectFit) ||
        Number(b.recommended) - Number(a.recommended)
    )
    return { matched: matchedList, hidden: hiddenList }
  }, [templates, windowValid, effStart, effEnd, pickedDays])

  function clearDates() {
    setRange(undefined)
    setShowHidden(false)
  }

  const filterActive = windowValid

  return (
    <main className="pt-32 pb-24 px-6 max-w-7xl mx-auto">
      {/* Hero title (right) + compact filter card (left), side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 lg:items-center mb-16">
        {/* ── LEFT: compact date filter card (matches the LINE LIFF panel) ─────── */}
        <div className="bg-white border border-zen-black/10 rounded-xl shadow-sm p-5 sm:p-6 order-2 lg:order-1">
          <div className="flex items-center justify-between gap-3 mb-5">
            <h2 className="font-headline font-black text-sm text-zen-black uppercase tracking-[0.15em]">
              กรองตามวันเดินทาง · Filter by dates
            </h2>
            {filterActive && (
              <button
                onClick={clearDates}
                className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-zen-black/40 hover:text-basel-brick transition-colors"
              >
                <X size={13} strokeWidth={3} /> ล้าง · Clear
              </button>
            )}
          </div>

          <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-basel-brick mb-2">
            ช่วงวันเดินทาง · Travel window
          </label>
          <DateRangePicker value={range} onChange={setRange} />

          <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-basel-brick mb-2 mt-5">
            ยืดหยุ่น · Flexibility
          </label>
          <div className="flex gap-2">
            {FLEX_CHIPS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFlex(opt.value)}
                title={opt.sub}
                className={`px-2 py-3 border rounded-lg text-center transition-all flex-1 ${
                  flex === opt.value
                    ? 'border-basel-brick bg-basel-brick text-white'
                    : 'border-zen-black/20 text-zen-black hover:border-basel-brick'
                }`}
              >
                <span className="block font-headline font-black text-xs tracking-tight whitespace-nowrap">
                  {opt.label}
                </span>
              </button>
            ))}
          </div>

          {filterActive && flex > 0 && effStart && effEnd && (
            <p className="text-[11px] text-zen-black/40 mt-3">
              ค้นหาในช่วง (รวมยืดหยุ่น ±{flex} วัน):{' '}
              {effStart.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} –{' '}
              {effEnd.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>

        {/* ── RIGHT: title + intro ────────────────────────────────────────────── */}
        <header className="order-1 lg:order-2">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-headline font-extrabold tracking-tighter text-basel-brick mb-6">
            แพลนพร้อมเที่ยว
          </h1>
          <p className="text-zen-black/70 text-lg max-w-xl leading-relaxed font-sans">
            ใส่วันเดินทาง เพื่อดูทริปที่ไปได้ชัวร์ในช่วงนั้น — หรือเลื่อนดูทริปได้เลย!
          </p>
          <p className="text-zen-black/40 text-sm mt-2 font-sans">
            Set your dates to see trips available during that time—or browse the full list below!
          </p>
        </header>
      </div>

      {/* Section header */}
      <div className="flex flex-col md:flex-row justify-between md:items-end mb-12 gap-4 md:gap-6 border-b-2 border-zen-black/5 pb-8">
        <div>
          <span className="text-basel-brick font-extrabold text-sm uppercase tracking-[0.3em] mb-4 block font-headline">
            {filterActive ? `Matching your dates · ${matched.length}` : 'All pre-planned trips'}
          </span>
          <h2 className="text-2xl md:text-4xl font-headline font-black tracking-tighter text-zen-black">
            {filterActive
              ? 'แพลนพร้อมเที่ยว คัดมาให้ตรงกับช่วงเวลาเดินทางของคุณ'
              : 'แพลนพร้อมเที่ยว'}
          </h2>
        </div>
      </div>

      {/* Trip grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-white p-4 rounded-xl animate-pulse">
              <div className="aspect-[4/5] bg-zen-black/5 rounded-lg mb-6" />
              <div className="h-6 bg-zen-black/10 rounded mb-2" />
              <div className="h-4 bg-zen-black/5 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="border-2 border-dashed border-zen-black/10 rounded-xl p-16 text-center">
          <p className="text-zen-black/40 font-sans text-lg">ยังไม่มีแพลนในขณะนี้</p>
        </div>
      ) : matched.length === 0 ? (
        <div className="border-2 border-dashed border-zen-black/10 rounded-xl p-16 text-center">
          <p className="text-zen-black/60 font-sans text-lg mb-2">ไม่มีแพลนที่เที่ยวได้ในช่วงวันที่เลือก</p>
          <p className="text-zen-black/40 font-sans text-sm">
            No trips fit these dates — try a longer window, more flexibility, or a different time of year.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {matched.map(({ tpl, recommended, perfectFit }) => (
            <PlanCard
              key={tpl.id}
              tpl={tpl}
              recommended={recommended}
              perfectFit={perfectFit}
              isSaved={savedIds.has(tpl.id)}
              isPending={pending.has(tpl.id)}
              onOpen={() => setSelectedId(tpl.id)}
              onHeart={(e) => toggleHeart(tpl.id, e)}
            />
          ))}
        </div>
      )}

      {/* Hidden (out-of-season / too-long) trips — escape hatch */}
      {filterActive && hidden.length > 0 && (
        <div className="mt-12">
          <button
            onClick={() => setShowHidden(!showHidden)}
            className="text-[11px] font-black uppercase tracking-widest text-zen-black/50 hover:text-basel-brick transition-colors inline-flex items-center gap-2"
          >
            <ChevronDown size={14} className={`transition-transform ${showHidden ? 'rotate-180' : ''}`} />
            {showHidden ? 'ซ่อน' : 'แสดง'} {hidden.length} แพลนที่ไม่ตรงช่วงนี้ · {hidden.length} not available for these dates
          </button>
          <AnimatePresence initial={false}>
            {showHidden && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mt-8">
                  {hidden.map((tpl) => (
                    <PlanCard
                      key={tpl.id}
                      tpl={tpl}
                      dimmed
                      isSaved={savedIds.has(tpl.id)}
                      isPending={pending.has(tpl.id)}
                      onOpen={() => setSelectedId(tpl.id)}
                      onHeart={(e) => toggleHeart(tpl.id, e)}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Preview + confirm modal */}
      <PlanPreviewModal
        template={selectedTemplate}
        defaultStartDate={startD ? toISODate(startD) : ''}
        defaultEndDate={endD ? toISODate(endD) : ''}
        callbackUrl="/pre-planned"
        onClose={() => setSelectedId(null)}
      />
    </main>
  )
}
