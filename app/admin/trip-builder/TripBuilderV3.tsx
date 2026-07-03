'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Save, X, ChevronLeft, ChevronRight, ChevronDown, Check, Circle, Sparkles } from 'lucide-react'
import type {
  ItineraryV3, DayV3, ActivityV3, PlanOverview, PlanPeriod, PlanPriority, Bilingual, PlanCarRental,
} from '@/lib/itinerary-types'
import { PLAN_MEAL_SLOTS } from '@/lib/itinerary-types'
import { AIRPORTS } from '@/lib/trips/itinerary-model'
import { deriveAvailability } from '@/lib/trips/import-plan'
import CoverPicker from '@/app/components/CoverPicker'
import AreaCombobox from './AreaCombobox'

/** An empty v3 plan for the "create" flow. */
function emptyV3(): ItineraryV3 {
  return { version: 3, title: '', totalDays: 1, overview: { title: '' }, days: [{ day: 1, name: { en: '', th: '' }, activities: [] }] }
}

// MVP slot list (columns.md). Meals are the only choosable slots (is_default applies).
const SLOTS = [
  'Logistics', 'Living', 'Admin & Services',
  'Breakfast', 'Brunch', 'Lunch', 'AfternoonMeal', 'Dinner', 'LatenightMeal',
  'Activity 1', 'Activity 2', 'Activity 3', 'Activity 4', 'Activity 5', 'Activity 6', 'Activity 7', 'Activity 8',
]
const PRIORITIES: PlanPriority[] = ['Must', 'Recommend', 'Normal']
const QUEUE_TIMES = ['Low', 'Mid', 'High', 'Reserve']
const BOOKING_POLICIES = ['Walk-in Only', 'Same-Day Ticket', 'Optional', 'Recommended', 'Mandatory']
const CATEGORY_TAGS = ['', 'food', 'cafe', 'shopping', 'nature', 'temple', 'landmark', 'experience', 'nightlife', 'transport', 'stay']
const LEVELS = ['😍', '⭐', '👌']
const MEALS = new Set<string>(PLAN_MEAL_SLOTS)
const inp = 'px-3 py-2 text-sm border border-zen-black/20 rounded-lg focus:outline-none focus:border-basel-brick bg-white w-full'

// Subset of the /api/admin/maps `place` payload the builder consumes (current pull set).
type MapsPlace = { placeId: string; rating?: number; openingHours?: string; googleMapsUri?: string; websiteUri?: string }
type MapsField = 'rating' | 'hours' | 'map' | 'website'

export interface V3Initial {
  id: string
  shareCode: string | null
  published: boolean
  itinerary: ItineraryV3
}

/** V3 admin editor. Holds the FULL ItineraryV3 in state and only mutates a subset of
 *  fields — every field not exposed here (rating, queue/booking, links, guides, highlights…)
 *  is preserved on save. The rich-field editors come in Phase 2b. */
export default function TripBuilderV3({ initial }: { initial?: V3Initial }) {
  const isEdit = !!initial
  const router = useRouter()
  const [itin, setItin] = useState<ItineraryV3>(initial?.itinerary ?? emptyV3())
  const [coverImages, setCoverImages] = useState<string[]>(initial?.itinerary.overview.cover_images ?? [])
  const [provinceCode, setProvinceCode] = useState('') // create only — the trip-code prefix
  const [tab, setTab] = useState<'info' | 'itinerary'>(isEdit ? 'itinerary' : 'info')
  const [activeDay, setActiveDay] = useState(0)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [error, setError] = useState('')

  // ── mutation helpers (every edit marks the form dirty) ──────────────────────
  const update = (fn: (p: ItineraryV3) => ItineraryV3) => { setItin(fn); setDirty(true); setSavedOk(false) }
  const ov = itin.overview
  const patchOverview = (patch: Partial<PlanOverview>) => update((p) => ({ ...p, overview: { ...p.overview, ...patch } }))
  const patchDay = (di: number, patch: Partial<DayV3>) =>
    update((p) => ({ ...p, days: p.days.map((d, i) => (i === di ? { ...d, ...patch } : d)) }))
  const patchAct = (di: number, ai: number, patch: Partial<ActivityV3>) =>
    update((p) => ({ ...p, days: p.days.map((d, i) => (i === di ? { ...d, activities: d.activities.map((a, j) => (j === ai ? { ...a, ...patch } : a)) } : d)) }))
  const addAct = (di: number) => {
    const newIdx = itin.days[di].activities.length
    update((p) => ({ ...p, days: p.days.map((d, i) => (i === di ? { ...d, activities: [...d.activities, { slot: 'Activity 1', name: { en: '', th: '' } }] } : d)) }))
    setExpanded((s) => new Set(s).add(`${di}-${newIdx}`)) // auto-open the new row
  }
  const removeAct = (di: number, ai: number) =>
    update((p) => ({ ...p, days: p.days.map((d, i) => (i === di ? { ...d, activities: d.activities.filter((_, j) => j !== ai) } : d)) }))
  const addDay = () => { update((p) => ({ ...p, days: [...p.days, { day: p.days.length + 1, name: { en: '', th: '' }, activities: [] }] })); setActiveDay(itin.days.length) }
  const removeDay = (di: number) => {
    update((p) => ({ ...p, days: p.days.filter((_, i) => i !== di).map((d, i) => ({ ...d, day: i + 1 })) }))
    setActiveDay((d) => Math.max(0, Math.min(d, itin.days.length - 2)))
  }

  const airports = itin.airports ?? []
  const toggleAirport = (code: string) =>
    update((p) => {
      const cur = p.airports ?? []
      return { ...p, airports: cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code] }
    })

  const periods = ov.recommended_period ?? []
  const setPeriod = (i: number, patch: Partial<PlanPeriod>) =>
    patchOverview({ recommended_period: periods.map((pp, j) => (j === i ? { ...pp, ...patch } : pp)) })
  const addPeriod = () => patchOverview({ recommended_period: [...periods, { primary: '', details: '' }] })
  const removePeriod = (i: number) => patchOverview({ recommended_period: periods.filter((_, j) => j !== i) })

  // highlights
  const highlights = itin.highlights ?? []
  const setHi = (i: number, patch: Partial<(typeof highlights)[number]>) =>
    update((p) => ({ ...p, highlights: (p.highlights ?? []).map((h, j) => (j === i ? { ...h, ...patch } : h)) }))
  const addHi = () => update((p) => ({ ...p, highlights: [...(p.highlights ?? []), { name: '', description: '', level: '⭐' }] }))
  const removeHi = (i: number) => update((p) => ({ ...p, highlights: (p.highlights ?? []).filter((_, j) => j !== i) }))

  // car rental (+ group-size presets)
  const setCar = (patch: Partial<PlanCarRental>) => patchOverview({ car_rental: { ...ov.car_rental, ...patch } })
  const carGroups = ov.car_rental?.details?.byGroupSize ?? []
  const setCarDetails = (groups: { size: string; advice: string }[]) =>
    setCar({ details: { ...ov.car_rental?.details, byGroupSize: groups } })

  const toggleRow = (key: string) => setExpanded((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n })

  // ── day navigation: ← → arrows (ignored while typing in a field) ────────────
  const di = Math.min(activeDay, itin.days.length - 1)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      if (tab !== 'itinerary' || (el && /input|textarea|select/i.test(el.tagName))) return
      if (e.key === 'ArrowRight') setActiveDay((d) => Math.min(d + 1, itin.days.length - 1))
      if (e.key === 'ArrowLeft') setActiveDay((d) => Math.max(d - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tab, itin.days.length])

  // ── warn before leaving with unsaved edits ─────────────────────────────────
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  // ✨ Fill empty TH from EN across day names + activity name/desc/notes/remark.
  async function generateTh() {
    type Tgt = { en: string; set: (th: string) => void }
    const targets: Tgt[] = []
    const need = (b?: { en?: string | null; th?: string | null } | null) => !!(b?.en?.trim() && !b.th?.trim())
    itin.days.forEach((d, di) => {
      if (need(d.name)) { const en = d.name.en; targets.push({ en, set: (th) => patchDay(di, { name: { en, th } }) }) }
      d.activities.forEach((a, ai) => {
        if (need(a.name)) { const en = a.name.en; targets.push({ en, set: (th) => patchAct(di, ai, { name: { en, th } }) }) }
        if (need(a.description)) { const en = a.description!.en; targets.push({ en, set: (th) => patchAct(di, ai, { description: { en, th } }) }) }
        if (need(a.notes)) { const en = a.notes!.en; targets.push({ en, set: (th) => patchAct(di, ai, { notes: { en, th } }) }) }
        if (need(a.remark)) { const en = a.remark!.en; targets.push({ en, set: (th) => patchAct(di, ai, { remark: { en, th } }) }) }
      })
    })
    if (targets.length === 0) { setError('ไม่มีช่อง EN ที่รอแปล (TH ว่าง)'); return }
    setTranslating(true); setError('')
    try {
      const res = await fetch('/api/admin/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texts: targets.map((t) => t.en) }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'แปลไม่สำเร็จ')
      const translations: string[] = data.translations ?? []
      targets.forEach((t, i) => { if (translations[i]) t.set(translations[i]) })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'แปลไม่สำเร็จ')
    } finally {
      setTranslating(false)
    }
  }

  async function save() {
    if (!ov.title.trim()) { setError('กรุณาตั้งชื่อทริป'); setTab('info'); return }
    setSaving(true); setError('')
    const hubs = airports.map((code) => ({ name: (AIRPORTS[code]?.label ?? code).replace(/\s*\(.*\)$/, ''), code }))
    const next: ItineraryV3 = {
      ...itin,
      title: ov.title.trim(),
      totalDays: itin.days.length,
      airports: airports.length ? airports : undefined,
      overview: { ...ov, title: ov.title.trim(), cover_images: coverImages, available_airports: { major_hubs: hubs } },
    }
    const payload = {
      title: next.title,
      itinerary: next,
      totalDays: next.totalDays,
      description: ov.cover_tagline ?? ov.description?.split('\n')[0] ?? null,
      coverImage: coverImages[0] ?? null,
      coverImages,
      availability: deriveAvailability(next),
    }
    try {
      const res = await fetch(isEdit ? `/api/admin/templates/${initial!.id}` : '/api/admin/templates', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? payload : { ...payload, published: false, provinceCode: provinceCode.trim() || undefined }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed')
      if (isEdit) {
        setDirty(false); setSavedOk(true)
      } else {
        const data = await res.json()
        setDirty(false)
        router.push(`/admin/trip-builder/${data.template.id}`) // continue as an edit session (now has a share code)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const day = itin.days[di]

  return (
    <main className="pt-[120px] pb-28 min-h-screen bg-briefing-cream px-6 md:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Title row */}
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-basel-brick">Admin · {isEdit ? 'Editor' : 'Builder'} (v3)</p>
            <h1 className="text-3xl md:text-4xl font-black font-headline tracking-tighter text-zen-black italic">{ov.title || (isEdit ? 'Edit Trip' : 'New Trip')}</h1>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Link href="/admin/dashboard" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zen-black/60 hover:text-basel-brick"><ArrowLeft size={14} strokeWidth={3} /> Dashboard</Link>
            {initial?.shareCode && <span className="font-mono font-bold bg-zen-black text-white px-2 py-0.5 rounded text-xs">{initial.shareCode}</span>}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-zen-black/[0.04] p-1 rounded-xl w-fit">
          {(['info', 'itinerary'] as const).map((tb) => (
            <button key={tb} onClick={() => setTab(tb)}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${tab === tb ? 'bg-white text-basel-brick shadow-sm' : 'text-zen-black/50 hover:text-zen-black'}`}>
              {tb === 'info' ? 'Trip info' : 'Itinerary'}
            </button>
          ))}
        </div>

        {/* ── Trip info tab ───────────────────────────────────────────────── */}
        {tab === 'info' && (
          <div className="bg-white border border-zen-black/10 rounded-xl p-4 space-y-3">
            <input value={ov.title} onChange={(e) => patchOverview({ title: e.target.value })} placeholder="ชื่อทริป · Title *" className={`${inp} font-bold`} />
            {!isEdit && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-basel-brick mb-1.5">พื้นที่ · Area <span className="text-zen-black/40 normal-case tracking-normal">(ใช้ขึ้นต้นรหัสทริป) *</span></p>
                <AreaCombobox value={provinceCode} onChange={(c) => { setProvinceCode(c); setDirty(true); setSavedOk(false) }} />
              </div>
            )}
            <input value={ov.cover_tagline ?? ''} onChange={(e) => patchOverview({ cover_tagline: e.target.value })} placeholder="ข้อความปก · Cover tagline (แสดงบนการ์ด)" className={inp} />
            <textarea value={ov.description ?? ''} onChange={(e) => patchOverview({ description: e.target.value })} rows={4} placeholder="คำอธิบายเต็ม · Full description (แสดงด้านใน)" className={`${inp} resize-y`} />

            <div className="pt-3 border-t border-zen-black/10">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-basel-brick mb-2">รูปปก · Cover images <span className="text-zen-black/40 normal-case tracking-normal">(สูงสุด 5)</span></p>
              <CoverPicker value={coverImages} onChange={(v) => { setCoverImages(v); setDirty(true); setSavedOk(false) }} max={5} />
            </div>

            <div className="pt-3 border-t border-zen-black/10">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-basel-brick mb-2">สนามบิน · Airports</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(AIRPORTS).map((code) => {
                  const on = airports.includes(code)
                  return (
                    <button key={code} type="button" onClick={() => toggleAirport(code)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all ${on ? 'border-basel-brick bg-basel-brick text-white' : 'border-zen-black/20 text-zen-black/60 hover:border-basel-brick'}`}>
                      {AIRPORTS[code].label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-zen-black/10">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-basel-brick">ช่วงแนะนำ · Recommended periods</p>
                <button onClick={addPeriod} className="text-[10px] font-black text-basel-brick hover:underline flex items-center gap-0.5"><Plus size={12} /> เพิ่ม</button>
              </div>
              <div className="space-y-2">
                {periods.length === 0 && <p className="text-xs text-zen-black/30">ยังไม่มีช่วงแนะนำ</p>}
                {periods.map((pp, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="flex-1 space-y-1.5">
                      <input value={pp.primary ?? ''} onChange={(e) => setPeriod(i, { primary: e.target.value })} placeholder='เช่น "1 Oct – 15 Nov"' className={`${inp} py-1.5`} />
                      <textarea value={pp.details ?? ''} onChange={(e) => setPeriod(i, { details: e.target.value })} rows={2} placeholder="รายละเอียด (ทำไมช่วงนี้ดี)" className={`${inp} py-1.5 resize-y`} />
                    </div>
                    <button onClick={() => removePeriod(i)} className="text-zen-black/30 hover:text-red-600 mt-2"><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-zen-black/40 mt-1.5">ตัวกรองวันที่หน้า /discover คำนวณจากช่วงเหล่านี้อัตโนมัติ</p>
            </div>

            {/* Arrival buffers */}
            <div className="pt-3 border-t border-zen-black/10 grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-basel-brick mb-1.5">ถึง → กิจกรรมแรก (ชม.)</p>
                <input type="number" step="0.5" value={ov.arrival_to_first_act_hrs ?? ''} onChange={(e) => patchOverview({ arrival_to_first_act_hrs: e.target.value ? parseFloat(e.target.value) : undefined })} placeholder="เช่น 2" className={`${inp} py-1.5`} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-basel-brick mb-1.5">ถึงสนามบินก่อนบินกลับ (ชม.)</p>
                <input type="number" step="0.5" value={ov.arrival_to_departure_airport_hrs ?? ''} onChange={(e) => patchOverview({ arrival_to_departure_airport_hrs: e.target.value ? parseFloat(e.target.value) : undefined })} placeholder="เช่น 3" className={`${inp} py-1.5`} />
              </div>
            </div>

            {/* Car rental */}
            <div className="pt-3 border-t border-zen-black/10">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-basel-brick">เช่ารถ · Car rental</p>
                <label className="flex items-center gap-1.5 text-[11px] text-zen-black/60"><input type="checkbox" checked={ov.car_rental?.primary === 'Y'} onChange={(e) => setCar({ primary: e.target.checked ? 'Y' : 'N' })} className="accent-basel-brick" /> มีเช่ารถ</label>
              </div>
              {ov.car_rental?.primary === 'Y' && (
                <div className="space-y-2">
                  <input value={ov.car_rental?.details?.rentalDuration ?? ''} onChange={(e) => setCar({ details: { ...ov.car_rental?.details, rentalDuration: e.target.value } })} placeholder="ระยะเวลาเช่า เช่น 4 days" className={`${inp} py-1.5`} />
                  {carGroups.map((g, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input value={g.size} onChange={(e) => setCarDetails(carGroups.map((x, j) => (j === i ? { ...x, size: e.target.value } : x)))} placeholder="กลุ่ม เช่น 1-2" className={`${inp} py-1.5 w-28!`} />
                      <input value={g.advice} onChange={(e) => setCarDetails(carGroups.map((x, j) => (j === i ? { ...x, advice: e.target.value } : x)))} placeholder="คำแนะนำรถ" className={`${inp} py-1.5 flex-1`} />
                      <button onClick={() => setCarDetails(carGroups.filter((_, j) => j !== i))} className="text-zen-black/30 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  ))}
                  <button onClick={() => setCarDetails([...carGroups, { size: '', advice: '' }])} className="text-[10px] font-black text-basel-brick hover:underline flex items-center gap-0.5"><Plus size={12} /> เพิ่มขนาดกลุ่ม</button>
                </div>
              )}
            </div>

            {/* Guides */}
            <div className="pt-3 border-t border-zen-black/10">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-basel-brick mb-2">คู่มือทริป · Guides (EN / TH)</p>
              <div className="space-y-2">
                {([['logistic_guide', 'การเดินทาง'], ['accommodation_guide', 'ที่พัก'], ['food_guide', 'อาหาร'], ['queue_guide', 'คิว'], ['remark', 'หมายเหตุ']] as const).map(([key, label]) => {
                  const o = ov as unknown as Record<string, string | undefined>
                  return (
                    <div key={key}>
                      <p className="text-[10px] text-zen-black/50 mb-1">{label}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <textarea value={o[`${key}_en`] ?? ''} onChange={(e) => patchOverview({ [`${key}_en`]: e.target.value } as Partial<PlanOverview>)} rows={2} placeholder={`${label} (EN)`} className={`${inp} py-1.5 resize-y`} />
                        <textarea value={o[`${key}_th`] ?? ''} onChange={(e) => patchOverview({ [`${key}_th`]: e.target.value } as Partial<PlanOverview>)} rows={2} placeholder={`${label} (TH)`} className={`${inp} py-1.5 resize-y`} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Highlights */}
            <div className="pt-3 border-t border-zen-black/10">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-basel-brick">ไฮไลต์ · Highlights</p>
                <button onClick={addHi} className="text-[10px] font-black text-basel-brick hover:underline flex items-center gap-0.5"><Plus size={12} /> เพิ่ม</button>
              </div>
              <div className="space-y-3">
                {highlights.length === 0 && <p className="text-xs text-zen-black/30">ยังไม่มีไฮไลต์</p>}
                {highlights.map((h, i) => (
                  <div key={i} className="flex items-start gap-2 border border-zen-black/10 rounded-lg p-2">
                    <div className="flex-1 space-y-2 min-w-0">
                      <div className="flex gap-2">
                        <select value={h.level || '⭐'} onChange={(e) => setHi(i, { level: e.target.value })} className={`${inp} py-1.5 w-16! shrink-0`}>{LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}</select>
                        <input value={h.name} onChange={(e) => setHi(i, { name: e.target.value })} placeholder="ชื่อสถานที่" className={`${inp} py-1.5 flex-1`} />
                      </div>
                      <textarea value={h.description} onChange={(e) => setHi(i, { description: e.target.value })} rows={2} placeholder="คำอธิบาย" className={`${inp} py-1.5 resize-y`} />
                      <div>
                        <p className="text-[10px] text-zen-black/40 mb-1">รูป (ไม่ระบุก็ได้)</p>
                        <CoverPicker value={h.image ? [h.image] : []} onChange={(v) => setHi(i, { image: v[0] ?? null })} max={1} />
                      </div>
                    </div>
                    <button onClick={() => removeHi(i)} className="text-zen-black/30 hover:text-red-600 mt-1 flex-shrink-0"><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Itinerary tab ──────────────────────────────────────────────── */}
        {tab === 'itinerary' && day && (
          <>
            {/* Day strip + prev/next */}
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setActiveDay((d) => Math.max(0, d - 1))} disabled={di === 0}
                className="p-2 rounded-lg border border-zen-black/15 text-zen-black/60 hover:border-basel-brick hover:text-basel-brick disabled:opacity-30 disabled:pointer-events-none"><ChevronLeft size={16} /></button>
              <div className="flex-1 flex gap-1.5 overflow-x-auto py-1">
                {itin.days.map((d, i) => (
                  <button key={i} onClick={() => setActiveDay(i)}
                    className={`flex-shrink-0 w-9 h-9 rounded-lg font-black text-sm transition-all ${i === di ? 'bg-basel-brick text-white' : 'bg-white border border-zen-black/15 text-zen-black/50 hover:border-basel-brick'}`}>
                    {d.day}
                  </button>
                ))}
              </div>
              <button onClick={() => setActiveDay((d) => Math.min(itin.days.length - 1, d + 1))} disabled={di === itin.days.length - 1}
                className="p-2 rounded-lg border border-zen-black/15 text-zen-black/60 hover:border-basel-brick hover:text-basel-brick disabled:opacity-30 disabled:pointer-events-none"><ChevronRight size={16} /></button>
              <span className="text-[11px] font-bold text-zen-black/40 whitespace-nowrap ml-1">Day {day.day} / {itin.days.length}</span>
            </div>

            {/* Active day */}
            <div className="bg-white border border-zen-black/10 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 bg-briefing-cream/60 border-b border-zen-black/10">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-basel-brick text-white font-black text-sm flex-shrink-0">{String(day.day).padStart(2, '0')}</span>
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <input value={day.name.en} onChange={(e) => patchDay(di, { name: { ...day.name, en: e.target.value } })} placeholder="ชื่อวัน (EN)" className={`${inp} py-1.5`} />
                  <input value={day.name.th} onChange={(e) => patchDay(di, { name: { ...day.name, th: e.target.value } })} placeholder="ชื่อวัน (TH)" className={`${inp} py-1.5`} />
                </div>
                {itin.days.length > 1 && <button onClick={() => removeDay(di)} title="ลบวันนี้" className="text-zen-black/40 hover:text-red-600 flex-shrink-0"><Trash2 size={16} /></button>}
              </div>

              <div className="p-4 space-y-2">
                {day.activities.length === 0 && <p className="text-xs text-zen-black/30 py-2">ยังไม่มีกิจกรรม</p>}
                {day.activities.map((a, ai) => (
                  <ActivityCard key={ai} a={a} di={di} ai={ai} open={expanded.has(`${di}-${ai}`)} onToggle={() => toggleRow(`${di}-${ai}`)} patch={patchAct} remove={removeAct} />
                ))}
                <button onClick={() => addAct(di)} className="w-full py-2 border border-dashed border-zen-black/20 rounded-lg text-zen-black/50 text-xs font-bold hover:border-basel-brick hover:text-basel-brick transition-all flex items-center justify-center gap-1.5"><Plus size={13} /> เพิ่มกิจกรรม</button>
              </div>
            </div>

            {/* Prev / Next day */}
            <div className="flex items-center justify-between mt-4">
              <button onClick={() => setActiveDay((d) => Math.max(0, d - 1))} disabled={di === 0}
                className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-zen-black/60 hover:text-basel-brick disabled:opacity-30 disabled:pointer-events-none"><ChevronLeft size={15} /> วันก่อน</button>
              {di === itin.days.length - 1
                ? <button onClick={addDay} className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-basel-brick hover:text-zen-black"><Plus size={15} /> เพิ่มวัน</button>
                : <button onClick={() => setActiveDay((d) => Math.min(itin.days.length - 1, d + 1))}
                    className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-zen-black/60 hover:text-basel-brick">วันถัดไป <ChevronRight size={15} /></button>}
            </div>
          </>
        )}

        {error && <p className="mt-4 text-sm text-red-600 flex items-center gap-1.5"><X size={14} /> {error}</p>}
      </div>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur border-t border-zen-black/10 px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <button onClick={generateTh} disabled={translating || saving} title="เติมภาษาไทยจากภาษาอังกฤษ (AI)"
            className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-basel-brick hover:text-zen-black disabled:opacity-40">
            <Sparkles size={14} strokeWidth={2.5} /> {translating ? 'กำลังแปล…' : 'เติม TH'}
          </button>
          <span className="text-[11px] font-bold flex items-center gap-1.5">
            {saving ? <span className="text-zen-black/50">กำลังบันทึก…</span>
              : dirty ? <span className="text-amber-600 flex items-center gap-1"><Circle size={8} fill="currentColor" /> ยังไม่บันทึก</span>
              : savedOk ? <span className="text-emerald-600 flex items-center gap-1"><Check size={13} strokeWidth={3} /> บันทึกแล้ว</span>
              : <span className="text-zen-black/30">{isEdit ? 'ไม่มีการเปลี่ยนแปลง' : 'แพลนใหม่ (ร่าง)'}</span>}
          </span>
          <button onClick={save} disabled={saving || (isEdit && !dirty)}
            className="ml-auto py-2.5 px-6 rounded-lg bg-basel-brick text-white font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black transition-all disabled:opacity-40 flex items-center gap-2">
            <Save size={14} /> {isEdit ? 'บันทึก' : 'สร้างแพลน'}
          </button>
        </div>
      </div>
    </main>
  )
}

// ── Activity card (collapsible) ──────────────────────────────────────────────
function ActivityCard({ a, di, ai, open, onToggle, patch, remove }: {
  a: ActivityV3; di: number; ai: number; open: boolean; onToggle: () => void
  patch: (di: number, ai: number, p: Partial<ActivityV3>) => void
  remove: (di: number, ai: number) => void
}) {
  const name = a.name ?? { en: '', th: '' }
  const desc = a.description ?? { en: '', th: '' }
  const setName = (b: Bilingual) => patch(di, ai, { name: b })
  const setDesc = (b: Bilingual) => patch(di, ai, { description: b })
  const summary = name.th || name.en || '(ยังไม่มีชื่อ)'
  const [more, setMore] = useState(false)
  const links = a.links ?? {}
  const notes = a.notes ?? { en: '', th: '' }
  const remark = a.remark ?? { en: '', th: '' }
  const setLink = (k: keyof NonNullable<ActivityV3['links']>, v: string) => patch(di, ai, { links: { ...a.links, [k]: v || null } })
  const [mapsLoading, setMapsLoading] = useState(false)
  // A pull no longer overwrites — it loads the Google result into a compare panel
  // and lets the admin pick, per field, between the existing JSON value and Google's.
  const [mapsResult, setMapsResult] = useState<MapsPlace | null>(null)
  const [mapsPick, setMapsPick] = useState<Record<MapsField, boolean>>({ rating: false, hours: false, map: false, website: false })
  async function fetchMaps() {
    const q = [a.name?.en || a.name?.th, a.location, 'Japan'].filter(Boolean).join(' ')
    if (!q.trim()) return
    setMapsLoading(true)
    try {
      const res = await fetch('/api/admin/maps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q, placeId: a.placeId || undefined }) })
      const data = await res.json()
      if (data.configured === false) { window.alert('ยังไม่ได้ตั้งค่า GOOGLE_MAPS_API_KEY ใน .env'); return }
      if (!res.ok) { window.alert(data.error ?? 'ดึงข้อมูลไม่สำเร็จ'); return }
      const p = data.place as MapsPlace
      setMapsResult(p)
      // Default each field to Google ONLY when the current value is empty — a pull
      // never clobbers curated data unless the admin opts in.
      setMapsPick({
        rating: a.rating == null,
        hours: !a.operating_hours,
        map: !a.links?.map,
        website: !a.links?.website,
      })
    } finally {
      setMapsLoading(false)
    }
  }
  function applyMaps() {
    const p = mapsResult
    if (!p) return
    const next: Partial<ActivityV3> = { placeId: p.placeId || a.placeId, maps_api_call: true }
    if (mapsPick.rating && typeof p.rating === 'number') next.rating = p.rating
    if (mapsPick.hours && p.openingHours) next.operating_hours = p.openingHours
    const linkPatch = { ...a.links }
    if (mapsPick.map && p.googleMapsUri) linkPatch.map = p.googleMapsUri
    if (mapsPick.website && p.websiteUri) linkPatch.website = p.websiteUri
    next.links = linkPatch
    patch(di, ai, next)
    setMapsResult(null)
  }

  return (
    <div className="border border-zen-black/10 rounded-lg bg-briefing-cream/30 overflow-hidden">
      {/* Collapsed summary row */}
      <div className="flex items-center gap-2 px-3 py-2">
        <button onClick={onToggle} className="flex-1 flex items-center gap-2 min-w-0 text-left">
          <ChevronDown size={15} className={`flex-shrink-0 text-zen-black/40 transition-transform ${open ? 'rotate-180' : ''}`} />
          <span className="text-[11px] font-bold text-basel-brick/80 w-11 flex-shrink-0">{a.time || '--:--'}</span>
          <span className="text-[10px] font-bold text-zen-black/40 px-1.5 py-0.5 rounded bg-zen-black/5 flex-shrink-0">{a.slot}</span>
          <span className="text-sm font-bold text-zen-black truncate">{summary}</span>
          {MEALS.has(a.slot) && a.is_default && <span className="text-[10px] flex-shrink-0">⭐</span>}
        </button>
        <button onClick={() => remove(di, ai)} className="text-zen-black/30 hover:text-red-600 flex-shrink-0"><X size={15} /></button>
      </div>

      {/* Expanded form */}
      {open && (
        <div className="px-3 pb-3 pt-1 space-y-2 border-t border-zen-black/10">
          <div className="flex items-center gap-2 flex-wrap">
            <select value={a.slot} onChange={(e) => patch(di, ai, { slot: e.target.value })} className={`${inp} py-1 w-auto!`}>
              {SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input value={a.time ?? ''} onChange={(e) => patch(di, ai, { time: e.target.value || null })} placeholder="--:--" className={`${inp} py-1 w-[72px]!`} />
            <input value={a.duration_min ?? ''} onChange={(e) => patch(di, ai, { duration_min: e.target.value ? parseInt(e.target.value, 10) || null : null })} placeholder="นาที" type="number" className={`${inp} py-1 w-[72px]!`} />
            <select value={a.priority ?? ''} onChange={(e) => patch(di, ai, { priority: (e.target.value || null) as ActivityV3['priority'] })} className={`${inp} py-1 w-auto!`}>
              <option value="">— priority —</option>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            {MEALS.has(a.slot) && (
              <label className="flex items-center gap-1 text-[11px] text-zen-black/60"><input type="checkbox" checked={!!a.is_default} onChange={(e) => patch(di, ai, { is_default: e.target.checked })} className="accent-amber-400" /> ⭐ แนะนำ</label>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={name.en} onChange={(e) => setName({ ...name, en: e.target.value })} placeholder="ชื่อ (EN)" className={`${inp} py-1.5`} />
            <input value={name.th} onChange={(e) => setName({ ...name, th: e.target.value })} placeholder="ชื่อ (TH)" className={`${inp} py-1.5`} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <textarea value={desc.en} onChange={(e) => setDesc({ ...desc, en: e.target.value })} rows={2} placeholder="คำอธิบาย (EN)" className={`${inp} py-1.5 resize-y`} />
            <textarea value={desc.th} onChange={(e) => setDesc({ ...desc, th: e.target.value })} rows={2} placeholder="คำอธิบาย (TH)" className={`${inp} py-1.5 resize-y`} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={a.cost ?? ''} onChange={(e) => patch(di, ai, { cost: e.target.value || null })} placeholder="ราคา · Cost" className={`${inp} py-1.5`} />
            <input value={a.location ?? ''} onChange={(e) => patch(di, ai, { location: e.target.value || null })} placeholder="พื้นที่ · Location (City, District)" className={`${inp} py-1.5`} />
          </div>

          <button type="button" onClick={() => setMore(!more)} className="text-[11px] font-bold text-basel-brick hover:underline flex items-center gap-1">
            <ChevronDown size={12} className={`transition-transform ${more ? 'rotate-180' : ''}`} /> {more ? 'ซ่อนข้อมูลเพิ่มเติม' : 'ข้อมูลเพิ่มเติม · More (เรตติ้ง/คิว/ลิงก์/โน้ต)'}
          </button>
          {more && (
            <div className="space-y-2 pt-1 border-t border-zen-black/10">
              <div className="flex items-center gap-2">
                <button type="button" onClick={fetchMaps} disabled={mapsLoading || !!mapsResult} className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1 disabled:opacity-40">
                  📍 {mapsLoading ? 'กำลังดึง…' : 'ดึงจาก Google Maps'}
                </button>
                {a.placeId && <span className="text-[9px] font-bold text-emerald-600">✓ linked</span>}
              </div>
              {mapsResult && (() => {
                // Only offer rows where Google actually returned a value to compare against.
                const rows = ([
                  { key: 'rating' as MapsField, label: '★ Rating', cur: a.rating != null ? String(a.rating) : '', goog: typeof mapsResult.rating === 'number' ? String(mapsResult.rating) : '' },
                  { key: 'hours' as MapsField, label: 'Hours', cur: a.operating_hours ?? '', goog: mapsResult.openingHours ?? '' },
                  { key: 'map' as MapsField, label: 'Map URL', cur: a.links?.map ?? '', goog: mapsResult.googleMapsUri ?? '' },
                  { key: 'website' as MapsField, label: 'Website', cur: a.links?.website ?? '', goog: mapsResult.websiteUri ?? '' },
                ]).filter((r) => r.goog)
                return (
                  <div className="rounded-lg border border-blue-300 bg-blue-50/60 p-2.5 space-y-2">
                    <p className="text-[11px] font-bold text-blue-800">
                      📍 ผลจาก Google Maps — เลือกข้อมูลที่จะใช้ทีละช่อง
                    </p>
                    {rows.length === 0 ? (
                      <p className="text-[11px] text-zen-black/50">ไม่มีข้อมูลใหม่จาก Google Maps สำหรับช่องเหล่านี้ (จะลิงก์ placeId ให้)</p>
                    ) : rows.map((r) => {
                      const useGoogle = mapsPick[r.key]
                      const pick = (g: boolean) => setMapsPick((m) => ({ ...m, [r.key]: g }))
                      const cell = 'flex-1 flex items-start gap-1.5 p-1.5 rounded border cursor-pointer text-[11px] min-w-0'
                      return (
                        <div key={r.key} className="space-y-1">
                          <span className="text-[10px] font-bold text-zen-black/60">{r.label}</span>
                          <div className="flex gap-2">
                            <label className={`${cell} ${!useGoogle ? 'border-basel-brick bg-white' : 'border-zen-black/15 bg-white/40'}`}>
                              <input type="radio" name={`maps-${di}-${ai}-${r.key}`} checked={!useGoogle} onChange={() => pick(false)} className="mt-0.5 accent-basel-brick flex-shrink-0" />
                              <span className="min-w-0 break-words"><span className="text-zen-black/40">ของเดิม · </span>{r.cur || <span className="italic text-zen-black/35">(ว่าง)</span>}</span>
                            </label>
                            <label className={`${cell} ${useGoogle ? 'border-blue-500 bg-white' : 'border-zen-black/15 bg-white/40'}`}>
                              <input type="radio" name={`maps-${di}-${ai}-${r.key}`} checked={useGoogle} onChange={() => pick(true)} className="mt-0.5 accent-blue-600 flex-shrink-0" />
                              <span className="min-w-0 break-words"><span className="text-blue-600/70">Google · </span>{r.goog}</span>
                            </label>
                          </div>
                        </div>
                      )
                    })}
                    <div className="flex items-center gap-2 pt-0.5">
                      <button type="button" onClick={applyMaps} className="text-[11px] font-bold text-white bg-basel-brick rounded px-3 py-1 hover:opacity-90">ใช้ที่เลือก · Apply</button>
                      <button type="button" onClick={() => setMapsResult(null)} className="text-[11px] font-bold text-zen-black/50 hover:underline">ยกเลิก · Cancel</button>
                    </div>
                  </div>
                )
              })()}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <input type="number" step="0.1" value={a.rating ?? ''} onChange={(e) => patch(di, ai, { rating: e.target.value ? parseFloat(e.target.value) : null })} placeholder="★ rating" className={`${inp} py-1.5`} />
                <select value={a.queue_time ?? ''} onChange={(e) => patch(di, ai, { queue_time: (e.target.value || null) as ActivityV3['queue_time'] })} className={`${inp} py-1.5`}>
                  <option value="">— queue —</option>{QUEUE_TIMES.map((q) => <option key={q} value={q}>{q}</option>)}
                </select>
                <select value={a.booking_policy ?? ''} onChange={(e) => patch(di, ai, { booking_policy: (e.target.value || null) as ActivityV3['booking_policy'] })} className={`${inp} py-1.5`}>
                  <option value="">— booking —</option>{BOOKING_POLICIES.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
                <select value={a.category ?? ''} onChange={(e) => patch(di, ai, { category: e.target.value || null })} className={`${inp} py-1.5`}>
                  {CATEGORY_TAGS.map((c) => <option key={c} value={c}>{c || '— category —'}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input value={a.operating_hours ?? ''} onChange={(e) => patch(di, ai, { operating_hours: e.target.value || null })} placeholder="เวลาเปิด · Hours" className={`${inp} py-1.5`} />
                <input value={a.how_to_book ?? ''} onChange={(e) => patch(di, ai, { how_to_book: e.target.value || null })} placeholder="วิธีจอง · How to book" className={`${inp} py-1.5`} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input value={notes.en} onChange={(e) => patch(di, ai, { notes: { ...notes, en: e.target.value } })} placeholder="โน้ต (EN)" className={`${inp} py-1.5`} />
                <input value={notes.th} onChange={(e) => patch(di, ai, { notes: { ...notes, th: e.target.value } })} placeholder="โน้ต (TH)" className={`${inp} py-1.5`} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input value={remark.en} onChange={(e) => patch(di, ai, { remark: { ...remark, en: e.target.value } })} placeholder="ข้อควรรู้ (EN)" className={`${inp} py-1.5`} />
                <input value={remark.th} onChange={(e) => patch(di, ai, { remark: { ...remark, th: e.target.value } })} placeholder="ข้อควรรู้ (TH)" className={`${inp} py-1.5`} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input value={links.map ?? ''} onChange={(e) => setLink('map', e.target.value)} placeholder="Map URL" className={`${inp} py-1.5`} />
                <input value={links.walking_route ?? ''} onChange={(e) => setLink('walking_route', e.target.value)} placeholder="Walking route URL" className={`${inp} py-1.5`} />
                <input value={links.website ?? ''} onChange={(e) => setLink('website', e.target.value)} placeholder="Website" className={`${inp} py-1.5`} />
                <input value={links.ig ?? ''} onChange={(e) => setLink('ig', e.target.value)} placeholder="Instagram" className={`${inp} py-1.5`} />
                <input value={links.fb ?? ''} onChange={(e) => setLink('fb', e.target.value)} placeholder="Facebook" className={`${inp} py-1.5`} />
                <input value={links.tt ?? ''} onChange={(e) => setLink('tt', e.target.value)} placeholder="TikTok" className={`${inp} py-1.5`} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
