'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Save, X, Clock, ChevronDown } from 'lucide-react'
import type { DayV2, Slot, NodeSnap, ItineraryV2, ActivityPriority, DateRange, TripAvailability } from '@/lib/itinerary-types'
import NodePicker from './NodePicker'
import RangeEditor from '@/app/components/RangeEditor'
import CoverPicker from '@/app/components/CoverPicker'
import { seasonsForRanges } from '@/lib/availability'
import { AIRPORTS } from '@/lib/trips/itinerary-model'

interface JpArea { code: string; name: string; nameTh: string | null; type: string; regionCode: string | null }
const AREA_TYPE_TH: Record<string, string> = { prefecture: 'จังหวัด', region: 'ภูมิภาค', both: 'จังหวัด + ภูมิภาค' }
const SEASON_EMOJI: Record<string, string> = { Winter: '❄️', Spring: '🌸', Summer: '☀️', Autumn: '🍁' }

const MEALS: { key: 'breakfast' | 'brunch' | 'lunch' | 'afternoon' | 'dinner' | 'latenight'; label: string }[] = [
  { key: 'breakfast', label: '🍳 เช้า' },
  { key: 'brunch', label: '🥐 สาย' },
  { key: 'lunch', label: '🍱 กลางวัน' },
  { key: 'afternoon', label: '🍵 บ่าย' },
  { key: 'dinner', label: '🍽️ เย็น' },
  { key: 'latenight', label: '🌙 ดึก' },
]

function newDay(day: number): DayV2 {
  return { day, location: '', meals: { breakfast: null, brunch: null, lunch: null, afternoon: null, dinner: null, latenight: null }, activities: [], accommodation: null, transport: [] }
}
const single = (node: NodeSnap): Slot => ({ kind: 'single', node })
// Pick-one choice (no pre-selected option for a template — traveler picks later).
const choice = (options: NodeSnap[]): Slot => ({ kind: 'choice', selected: null, options })

export interface BuilderInitial {
  id: string
  title: string
  description: string | null
  coverImage: string | null
  coverImages: string[]
  shareCode: string | null
  published: boolean
  season: string | null
  availability: TripAvailability | null
  airports: string[]
  days: DayV2[]
}

/** Admin v2 trip builder — mix-and-match library nodes into day slots, save as a template.
 *  Pass `initial` to edit an existing template (PATCH) instead of creating one (POST). */
export default function TripBuilder({ initial }: { initial?: BuilderInitial }) {
  const isEdit = !!initial
  const [title, setTitle] = useState(initial?.title ?? '')
  const [provinceCode, setProvinceCode] = useState('')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [coverImages, setCoverImages] = useState<string[]>(
    initial?.coverImages?.length ? initial.coverImages : initial?.coverImage ? [initial.coverImage] : []
  )
  const [available, setAvailable] = useState<DateRange[]>(initial?.availability?.available ?? [])
  const [recommended, setRecommended] = useState<DateRange[]>(initial?.availability?.recommended ?? [])
  // Season is derived from the availability windows (recommended first), not picked.
  const recSeasons = seasonsForRanges(recommended)
  const availSeasons = seasonsForRanges(available)
  const derivedSeason = recSeasons[0] ?? availSeasons[0] ?? null
  const [airports, setAirports] = useState<string[]>(initial?.airports ?? [])
  const [days, setDays] = useState<DayV2[]>(initial?.days ?? [newDay(1)])
  const [areas, setAreas] = useState<JpArea[]>([])
  const [nextCode, setNextCode] = useState<string | null>(null)
  const [picker, setPicker] = useState<{ onPick: (n: NodeSnap) => void } | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/jp-areas').then((r) => r.json()).then((d) => setAreas(d.areas ?? [])).catch(() => {})
  }, [])

  const pickedArea = areas.find((a) => a.code === provinceCode)

  // Preview the real next code for the picked area (KYO-002 when KYO-001 exists).
  useEffect(() => {
    const area = areas.find((a) => a.code === provinceCode)
    if (!area) { setNextCode(null); return }
    let cancelled = false
    fetch(`/api/admin/templates/next-code?prefix=${area.code}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.code) setNextCode(d.code) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [provinceCode, areas])

  function updateDay(i: number, fn: (d: DayV2) => DayV2) {
    setDays((prev) => prev.map((d, idx) => (idx === i ? fn(d) : d)))
  }
  function addDay() { setDays((p) => [...p, newDay(p.length + 1)]) }
  function removeDay(i: number) { setDays((p) => p.filter((_, idx) => idx !== i).map((d, idx) => ({ ...d, day: idx + 1 }))) }
  function pick(onPick: (n: NodeSnap) => void) {
    setPicker({ onPick: (n) => { onPick(n); setPicker(null) } })
  }

  async function save() {
    if (!title.trim()) { setError('กรุณาตั้งชื่อทริป'); return }
    if (days.some((d) => !d.location.trim())) { setError('กรุณากรอกเมืองให้ครบทุกวัน'); return }
    if (!isEdit) {
      if (!provinceCode.trim()) { setError('กรุณาเลือกจังหวัด/ภูมิภาค (ใช้ขึ้นต้นรหัสทริป)'); return }
      // Only hard-block on mismatch when the list actually loaded — otherwise the
      // server validates it (avoids being stuck if /api/admin/jp-areas hiccups).
      if (areas.length > 0 && !pickedArea) { setError('รหัสจังหวัด/ภูมิภาคไม่ตรงกับรายการ — เลือกจากรายการที่มี'); return }
    }
    setSaving(true); setError('')
    const itinerary: ItineraryV2 = { version: 2, title: title.trim(), totalDays: days.length, season: derivedSeason || undefined, description: description || undefined, airports: airports.length ? airports : undefined, days }
    const availability = available.length || recommended.length ? { available, recommended } : null
    try {
      // Edit → PATCH the existing template (keeps its shareCode + published state);
      // Create → POST a new draft. Province only mints a code on create.
      const res = await fetch(isEdit ? `/api/admin/templates/${initial!.id}` : '/api/admin/templates', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(), itinerary, totalDays: days.length, season: derivedSeason || undefined,
          description: description || null, coverImage: coverImages[0] ?? null, coverImages, availability,
          ...(isEdit ? {} : { published: false, provinceCode: provinceCode.trim() || undefined }),
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed')
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed'); setSaving(false)
    }
  }

  function reset() {
    setSaved(false); setSaving(false); setTitle(''); setProvinceCode(''); setDescription('')
    setCoverImages([]); setAvailable([]); setRecommended([]); setAirports([]); setDays([newDay(1)])
  }

  const inp = 'px-3 py-2 text-sm border border-zen-black/20 rounded-lg focus:outline-none focus:border-basel-brick bg-white'

  if (saved) {
    return (
      <main className="pt-[120px] pb-24 min-h-screen bg-briefing-cream px-6 flex items-start justify-center">
        <div className="max-w-md w-full bg-white border border-zen-black/10 rounded-xl p-8 text-center mt-10 shadow-sm">
          <div className="w-14 h-14 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-4">
            <Save size={22} className="text-emerald-600" strokeWidth={2.5} />
          </div>
          <h2 className="font-headline font-black text-2xl italic text-zen-black mb-2">{isEdit ? 'บันทึกการแก้ไขแล้ว!' : 'บันทึกแล้ว!'}</h2>
          <p className="text-sm text-zen-black/60 leading-relaxed mb-6">
            {isEdit
              ? <>อัปเดตแพลนเรียบร้อย — ดูได้ที่ Dashboard แท็บ <b>Pre-planned</b></>
              : <>ทริปถูกบันทึกเป็น <b>แบบร่าง (ยังไม่เผยแพร่)</b> — ดูและกด “เผยแพร่” ได้ที่ Dashboard แท็บ <b>Pre-planned</b></>}
          </p>
          <div className="flex gap-3">
            <Link href="/admin/dashboard" className="flex-1 py-3 rounded-lg bg-basel-brick text-white font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black transition-all">
              ไปที่ Dashboard
            </Link>
            {!isEdit && (
              <button onClick={reset} className="flex-1 py-3 rounded-lg border-2 border-zen-black font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black hover:text-white transition-all">
                สร้างอีกอัน
              </button>
            )}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="pt-[120px] pb-24 min-h-screen bg-briefing-cream px-6 md:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-8 border-b border-zen-black/10 pb-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-basel-brick">Admin · {isEdit ? 'Editor' : 'Builder'}</p>
            <h1 className="text-4xl md:text-5xl font-black font-headline tracking-tighter text-zen-black italic">{isEdit ? 'Edit Trip' : 'Trip Builder'}</h1>
            <p className="text-sm text-zen-black/50 mt-1">{isEdit ? 'แก้ไขแพลนแบบ node/slot (v2)' : 'สร้างแพลนแบบ node/slot'}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Link href="/admin/dashboard" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zen-black/60 hover:text-basel-brick"><ArrowLeft size={14} strokeWidth={3} /> Dashboard</Link>
          </div>
        </div>

        {/* Meta */}
        <div className="bg-white border border-zen-black/10 rounded-xl p-4 mb-6 space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ชื่อทริป · Trip title *" className={`${inp} w-full font-bold`} />
          {isEdit ? (
            <div className="flex items-center gap-3 text-sm px-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-basel-brick">Share code</span>
              {initial?.shareCode
                ? <span className="font-mono font-bold bg-zen-black text-white px-2 py-0.5 rounded">{initial.shareCode}</span>
                : <span className="text-zen-black/30">—</span>}
              <span className="ml-auto text-zen-black/50">{days.length} วัน</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <AreaPicker areas={areas} value={provinceCode} onChange={setProvinceCode} />
                <div className="flex items-center text-sm text-zen-black/50 px-1">{days.length} วัน</div>
              </div>
              {provinceCode && (
                <p className="text-[11px] -mt-1 px-1">
                  {pickedArea
                    ? <span className="text-emerald-700">✓ <span className="font-mono font-bold">{pickedArea.code}</span> — {pickedArea.name}{pickedArea.nameTh ? ` · ${pickedArea.nameTh}` : ''} · {AREA_TYPE_TH[pickedArea.type] ?? pickedArea.type} → โค้ดจะเป็น <span className="font-mono font-bold">{nextCode ?? `${pickedArea.code}-…`}</span></span>
                    : <span className="text-amber-600">รหัส “{provinceCode}” ไม่ตรงกับจังหวัด/ภูมิภาคในรายการ</span>}
                </p>
              )}
            </>
          )}
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="คำอธิบายสั้น ๆ · Description" className={`${inp} w-full resize-y`} />

          {/* Cover gallery — up to 5; the first is the primary cover (cards),
              the rest are swiped in the published preview. */}
          <div className="pt-3 border-t border-zen-black/10">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-basel-brick mb-2">รูปปก · Cover images <span className="text-zen-black/40 normal-case tracking-normal">(สูงสุด 5 · swipe in preview)</span></p>
            <CoverPicker value={coverImages} onChange={setCoverImages} max={5} />
          </div>

          {/* Airports — which serve this trip; drives the traveler's flight picker. */}
          <div className="pt-3 border-t border-zen-black/10">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-basel-brick mb-2">สนามบิน · Airports <span className="text-zen-black/40 normal-case tracking-normal">(ที่ใช้เข้า-ออกทริปนี้)</span></p>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(AIRPORTS).map((code) => {
                const on = airports.includes(code)
                return (
                  <button key={code} type="button"
                    onClick={() => setAirports((prev) => on ? prev.filter((c) => c !== code) : [...prev, code])}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all ${on ? 'border-basel-brick bg-basel-brick text-white' : 'border-zen-black/20 text-zen-black/60 hover:border-basel-brick'}`}>
                    {AIRPORTS[code].label}
                  </button>
                )
              })}
            </div>
            {airports.length === 0 && <p className="text-[10px] text-zen-black/40 mt-1.5">ไม่เลือก = แสดงทุกสนามบินตอนผู้ใช้กรอกเที่ยวบิน</p>}
          </div>
        </div>

        {/* Availability — drives the /pre-planned date filter */}
        <div className="bg-white border border-zen-black/10 rounded-xl p-4 mb-6 space-y-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-basel-brick">ช่วงเวลาเที่ยว · Travel availability</p>
            <p className="text-[11px] text-zen-black/50 mt-1 leading-relaxed">
              ใช้กรองในหน้า /pre-planned — เว้น “Available” ว่าง = เที่ยวได้ทั้งปี · วันที่เป็นแบบไม่ระบุปี (เดือน-วัน)
            </p>
          </div>
          <RangeEditor label="Available (open) windows" hint="เปิดให้เที่ยว · open" ranges={available} onChange={setAvailable} />
          <RangeEditor label="Recommended windows" hint="แนะนำ ✨ · best time" ranges={recommended} onChange={setRecommended} />
          {(recSeasons.length > 0 || availSeasons.length > 0) && (
            <p className="text-[11px] text-zen-black/70 flex flex-wrap items-center gap-x-2 gap-y-1 pt-2 border-t border-zen-black/5">
              <span className="font-black uppercase tracking-widest text-[10px] text-basel-brick">ฤดูกาล (อัตโนมัติ)</span>
              {(recSeasons.length ? recSeasons : availSeasons).map((s) => <span key={s} className="font-medium">{SEASON_EMOJI[s] ?? ''} {s}</span>)}
              <span className="text-zen-black/40">{recSeasons.length ? '· จากช่วงแนะนำ' : '· จากช่วงเปิด'}</span>
            </p>
          )}
        </div>

        {/* Days */}
        <div className="space-y-5">
          {days.map((d, i) => (
            <div key={i} className="bg-white border border-zen-black/10 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 bg-briefing-cream/60 border-b border-zen-black/10">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-basel-brick text-white font-black text-sm">{String(d.day).padStart(2, '0')}</span>
                <input value={d.location} onChange={(e) => updateDay(i, (x) => ({ ...x, location: e.target.value }))} placeholder="เมือง / พื้นที่ · Location *" className={`${inp} flex-1`} />
                <label className="flex items-center gap-1.5 text-[11px] text-zen-black/60"><input type="checkbox" checked={!!d.free} onChange={(e) => updateDay(i, (x) => ({ ...x, free: e.target.checked }))} className="accent-basel-brick" /> วันอิสระ</label>
                {days.length > 1 && <button onClick={() => removeDay(i)} className="text-zen-black/40 hover:text-red-600"><Trash2 size={16} /></button>}
              </div>

              <div className="p-4 space-y-4">
                {/* Meals */}
                <Section title="มื้ออาหาร · Meals">
                  {MEALS.map((m) => (
                    <SlotEditor key={m.key} label={m.label}
                      slot={d.meals[m.key] ?? null}
                      onChange={(s) => updateDay(i, (x) => ({ ...x, meals: { ...x.meals, [m.key]: s } }))}
                      pick={pick}
                    />
                  ))}
                </Section>

                {/* Activities */}
                <Section title="ไทม์ไลน์ · Timeline nodes" onAdd={() => pick((n) => updateDay(i, (x) => ({ ...x, activities: [...x.activities, { time: null, priority: 'optional', node: n }] })))}>
                  {d.activities.length === 0 && <p className="text-xs text-zen-black/30">ยังไม่มีโหนด — เพิ่มสถานที่ / อาหาร / การเดินทาง (logistics node) ลงไทม์ไลน์</p>}
                  {d.activities.map((a, ai) => (
                    <div key={ai} className="flex items-center gap-2 text-sm">
                      <span className="relative w-[72px] flex-shrink-0">
                        <Clock size={11} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-zen-black/30" />
                        <input value={a.time ?? ''} onChange={(e) => updateDay(i, (x) => ({ ...x, activities: x.activities.map((y, k) => k === ai ? { ...y, time: e.target.value || null } : y) }))} placeholder="--:--" className={`${inp} w-full pl-6 py-1`} />
                      </span>
                      <select value={a.priority ?? 'optional'} onChange={(e) => updateDay(i, (x) => ({ ...x, activities: x.activities.map((y, k) => k === ai ? { ...y, priority: e.target.value as ActivityPriority } : y) }))} className={`${inp} py-1`}>
                        <option value="mandatory">ต้อง</option><option value="recommended">แนะนำ</option><option value="optional">เสริม</option>
                      </select>
                      <span className="flex-1 flex items-center gap-1.5 min-w-0"><span>{a.node.emoji}</span><span className="truncate font-medium">{a.node.name}</span></span>
                      <button onClick={() => updateDay(i, (x) => ({ ...x, activities: x.activities.filter((_, k) => k !== ai) }))} className="text-zen-black/30 hover:text-red-600"><X size={14} /></button>
                    </div>
                  ))}
                </Section>

                {/* Accommodation */}
                <Section title="ที่พัก · Accommodation">
                  <SlotEditor label="🏨 พัก" slot={d.accommodation}
                    onChange={(s) => updateDay(i, (x) => ({ ...x, accommodation: s }))}
                    pick={pick}
                  />
                </Section>
              </div>
            </div>
          ))}
        </div>

        <button onClick={addDay} className="mt-5 w-full py-3 border-2 border-dashed border-zen-black/20 rounded-xl text-zen-black/50 font-headline font-black text-xs uppercase tracking-widest hover:border-basel-brick hover:text-basel-brick transition-all flex items-center justify-center gap-2"><Plus size={15} /> เพิ่มวัน</button>

        {error && <p className="mt-4 text-sm text-red-600 flex items-center gap-1.5"><X size={14} /> {error}</p>}

        <button onClick={save} disabled={saving} className="mt-6 w-full py-4 rounded-xl bg-basel-brick text-white font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black transition-all disabled:opacity-40 flex items-center justify-center gap-2">
          <Save size={15} /> {saving ? 'กำลังบันทึก...' : 'บันทึกเป็นเทมเพลต (ร่าง)'}
        </button>
        <p className="mt-2 text-[11px] text-zen-black/40 text-center">บันทึกเป็นแบบร่าง (ยังไม่เผยแพร่) — เปิดเผยแพร่ได้ที่ Dashboard</p>
      </div>

      {picker && <NodePicker onPick={picker.onPick} onClose={() => setPicker(null)} />}
    </main>
  )
}

function Section({ title, onAdd, children }: { title: string; onAdd?: () => void; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-basel-brick">{title}</p>
        {onAdd && <button onClick={onAdd} className="text-[10px] font-black text-basel-brick hover:underline flex items-center gap-0.5"><Plus size={12} /> เพิ่ม</button>}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

// Single OR pick-one choice. 0 options = empty, 1 = single, 2+ = a choice the
// traveler picks from (renders as the swipe carousel). No default is set (template).
function SlotEditor({ label, slot, onChange, pick }: {
  label: string
  slot: Slot | null
  onChange: (s: Slot | null) => void
  pick: (onPick: (n: NodeSnap) => void) => void
}) {
  const options = slot ? (slot.kind === 'single' ? [slot.node] : slot.options) : []
  const isChoice = slot?.kind === 'choice'

  const addOption = () => pick((n) => {
    const next = [...options, n]
    onChange(next.length > 1 ? choice(next) : single(next[0]))
  })
  const removeOption = (idx: number) => {
    const next = options.filter((_, k) => k !== idx)
    onChange(next.length === 0 ? null : next.length === 1 ? single(next[0]) : choice(next))
  }

  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="w-20 text-[11px] font-bold text-zen-black/50 flex-shrink-0 pt-1.5">{label}</span>
      <div className="flex-1 space-y-1 min-w-0">
        {options.map((node, idx) => (
          <span key={idx} className="flex items-center gap-1.5 min-w-0 bg-briefing-cream/60 rounded px-2 py-1">
            {isChoice && <span className="text-[9px] font-black text-blue-500 flex-shrink-0 w-3">{idx + 1}</span>}
            <span>{node.emoji}</span>
            <span className="truncate font-medium text-zen-black">{node.name}</span>
            {node.cost && <span className="text-[11px] text-basel-brick font-bold ml-auto whitespace-nowrap">{node.cost}</span>}
            <button onClick={() => removeOption(idx)} className="text-zen-black/30 hover:text-red-600 flex-shrink-0"><X size={14} /></button>
          </span>
        ))}
        <button onClick={addOption} className="w-full text-left text-zen-black/40 border border-dashed border-zen-black/20 rounded px-2 py-1 hover:border-basel-brick transition-colors text-[12px]">
          {options.length === 0 ? '+ เลือกโหนด' : '+ เพิ่มตัวเลือก (ให้ผู้ใช้เลือก 1)'}
        </button>
        {isChoice && <p className="text-[10px] text-blue-500/80">เลือก 1 จาก {options.length} — แสดงเป็นการ์ดให้เลือก (swipe)</p>}
      </div>
    </div>
  )
}

// ── Area combobox ────────────────────────────────────────────────────────────
// Type to filter; clicking the field (or clearing the text) shows ALL areas —
// unlike a native <datalist>, which filters by the current value.
function AreaPicker({ areas, value, onChange }: { areas: JpArea[]; value: string; onChange: (code: string) => void }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [typing, setTyping] = useState(false)

  const q = query.trim().toLowerCase()
  const filtered = !typing || !q
    ? areas
    : areas.filter((a) => a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q) || (a.nameTh ?? '').includes(query.trim()))

  const picked = areas.find((a) => a.code === value)
  // When closed, show the full label "KSI — Kansai · คันไซ"; when open, the search query.
  const closedLabel = picked ? `${picked.code} — ${picked.name}${picked.nameTh ? ` · ${picked.nameTh}` : ''}` : value

  function commit(a: JpArea) { onChange(a.code); setOpen(false); setTyping(false) }
  // Open showing the full list. Used by both focus AND click, so clicking the
  // field after a selection re-opens it (focus alone won't fire if already focused).
  function openMenu(el?: HTMLInputElement | null) { setQuery(value); setTyping(false); setOpen(true); el?.select() }

  return (
    <div className="relative">
      <input
        value={open ? query : closedLabel}
        onFocus={(e) => openMenu(e.currentTarget)}
        onClick={(e) => { if (!open) openMenu(e.currentTarget) }}
        onChange={(e) => {
          setTyping(true)
          setQuery(e.target.value)
          const exact = areas.find((x) => x.code.toLowerCase() === e.target.value.trim().toLowerCase())
          onChange(exact ? exact.code : '')
        }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder="พิมพ์ค้นหา · จังหวัด/ภูมิภาค"
        title="พิมพ์ค้นหาแล้วเลือก เช่น Tokyo, Kanto, HOK"
        className="w-full pl-3 pr-8 py-2 text-sm border border-zen-black/20 rounded-lg focus:outline-none focus:border-basel-brick bg-white"
      />
      <ChevronDown size={16} className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-zen-black/35 pointer-events-none transition-transform ${open ? 'rotate-180' : ''}`} />
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-zen-black/15 rounded-lg shadow-xl max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-zen-black/40">ไม่พบจังหวัด/ภูมิภาค</div>
          ) : (
            filtered.map((a) => (
              <button
                key={a.code}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(a)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-briefing-cream ${a.code === value ? 'bg-briefing-cream/70' : ''}`}
              >
                <span className="font-mono font-bold text-basel-brick w-9 flex-shrink-0">{a.code}</span>
                <span className="flex-1 truncate text-zen-black">{a.name}{a.nameTh ? ` · ${a.nameTh}` : ''}</span>
                <span className="text-[10px] text-zen-black/40 flex-shrink-0">{AREA_TYPE_TH[a.type] ?? a.type}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
