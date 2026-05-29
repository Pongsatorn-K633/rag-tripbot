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

type EvaluatedPlan = { tpl: PlanTemplate; recommended: boolean }

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

  const { matched, hidden } = useMemo(() => {
    if (!windowValid || !effStart || !effEnd) {
      return {
        matched: templates.map((t) => ({ tpl: t, recommended: false })) as EvaluatedPlan[],
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

  function clearDates() {
    setRange(undefined)
    setShowHidden(false)
  }

  const filterActive = windowValid

  return (
    <main className="pt-32 pb-24 px-6 max-w-7xl mx-auto">
      {/* Hero header */}
      <header className="mb-10">
        <h1 className="text-4xl md:text-5xl lg:text-7xl font-headline font-extrabold tracking-tighter text-basel-brick mb-6">
          แพลนพร้อมเที่ยว
        </h1>
        <p className="text-zen-black/70 text-lg max-w-2xl leading-relaxed font-sans">
          เลือกช่วงวันเดินทางเพื่อกรองเฉพาะแพลนที่เที่ยวได้จริงในช่วงนั้น — ไม่เจอสถานที่ปิด
        </p>
        <p className="text-zen-black/40 text-sm mt-1 font-sans">
          Pick your travel window to see only trips that are actually open then — or browse all below
        </p>
      </header>

      {/* ── OPTIONAL DATE FILTER ─────────────────────────────────────────────── */}
      <div className="bg-white border border-zen-black/10 shadow-sm p-5 sm:p-6 mb-12">
        <div className="flex items-center justify-between gap-3 mb-4">
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

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-4 lg:items-start">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-basel-brick mb-2">
              ช่วงวันเดินทาง · Travel window
            </label>
            <DateRangePicker value={range} onChange={setRange} />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-basel-brick mb-2">
              ยืดหยุ่น · Flexibility
            </label>
            <div className="flex gap-2">
              {FLEX_CHIPS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFlex(opt.value)}
                  title={opt.sub}
                  className={`px-3 py-3 border text-center transition-all flex-1 lg:flex-none ${
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
          </div>
        </div>

        {filterActive && flex > 0 && effStart && effEnd && (
          <p className="text-[11px] text-zen-black/40 mt-3">
            ค้นหาในช่วง (รวมยืดหยุ่น ±{flex} วัน):{' '}
            {effStart.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} –{' '}
            {effEnd.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        )}
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
          {matched.map(({ tpl, recommended }) => (
            <PlanCard
              key={tpl.id}
              tpl={tpl}
              recommended={recommended}
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
        callbackUrl="/pre-planned"
        onClose={() => setSelectedId(null)}
      />
    </main>
  )
}
