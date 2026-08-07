'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, Reorder, useReducedMotion } from 'motion/react'
import { ArrowDown, ArrowUp, CalendarDays, Check, ChevronRight, GripVertical, Plus, Save, Star, Trash2, X } from 'lucide-react'
import ActivityFields, { nextActivitySlot } from '@/app/components/ActivityFields'
import { v3DayHighlight } from '@/lib/trips/itinerary-model'
import CoverUpload from '@/app/components/CoverUpload'
import { resolveCoverImage } from '@/lib/cover-image'
import Image from 'next/image'
import type { ItineraryV3, ActivityV3 } from '@/lib/itinerary-types'
import { PLAN_MEAL_SLOTS } from '@/lib/itinerary-types'

/**
 * The traveller's editor for their OWN copy of a trip.
 *
 * A user trip is its own document — a copy that no longer answers to the
 * pre-planned trip it came from — so this edits freely and never "fixes" the
 * plan back toward its template. Reordering days into a route whose transport no
 * longer connects is the traveller's call to make (owner decision, 2026-08-08).
 *
 * Every activity field comes from the SHARED ActivityFields form (the same one
 * the admin builder renders), in `traveller` mode: no ⭐ is_default, no ★ rating,
 * no Maps pull. Spec: docs/trip-editor-plan.md.
 */

const MEALS = new Set<string>(PLAN_MEAL_SLOTS)
const MEAL_LABEL: Record<string, string> = {
  Breakfast: '🍳 มื้อเช้า', Brunch: '🥐 มื้อสาย', Lunch: '🍱 มื้อกลางวัน',
  AfternoonMeal: '🍵 มื้อบ่าย', Dinner: '🍽️ มื้อเย็น', LatenightMeal: '🌙 มื้อดึก',
}
const nameOf = (a: ActivityV3) => a.name?.th || a.name?.en || '(ยังไม่มีชื่อ)'

const label = 'text-[11px] font-bold uppercase tracking-wider text-basel-brick'
const field =
  'w-full rounded-xl border border-zen-black/15 bg-white px-3 py-2 text-sm text-zen-black transition-colors placeholder:text-graphite/40 focus:border-basel-brick focus:outline-none'
const pill =
  'inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 font-detail text-[11px] font-semibold transition-colors'

export default function ItineraryEditorV3({
  initialItinerary,
  initialStartDate = '',
  initialTitle = '',
  saving = false,
  onSave,
}: {
  initialItinerary: ItineraryV3
  initialStartDate?: string
  initialTitle?: string
  saving?: boolean
  onSave: (data: { itinerary: ItineraryV3; startDate: string; title: string }) => void
}) {
  const [itin, setItin] = useState<ItineraryV3>(initialItinerary)
  const [startDate, setStartDate] = useState(initialStartDate)
  const [title, setTitle] = useState(initialTitle)
  const [openDay, setOpenDay] = useState<number | null>(itin.days[0]?.day ?? null)
  const [openAct, setOpenAct] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const reduced = useReducedMotion() ?? false

  /** Shared open/close transition for the day + activity bodies. Height 0 ⇄ auto
   *  with the app's standard easing; instant when the OS asks for less motion. */
  const collapse = {
    initial: { height: 0, opacity: 0 },
    animate: { height: 'auto', opacity: 1 },
    exit: { height: 0, opacity: 0 },
    transition: reduced
      ? { duration: 0 }
      : { height: { duration: 0.28, ease: [0.4, 0, 0.2, 1] as const }, opacity: { duration: 0.18 } },
    // The wrapper clips; the PADDING lives on the inner div, or it would fight
    // the height animation and the card would jump at 0.
    className: 'overflow-hidden',
  }

  // Explicit save, so an unsaved edit must not vanish silently. (Autosave was
  // rejected: every keystroke would rewrite an ~86 KB jsonb blob with no undo.)
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  /** Every mutation goes through here, so nothing can change without marking dirty. */
  function edit(fn: (draft: ItineraryV3) => ItineraryV3) {
    setItin((prev) => fn(prev))
    setDirty(true)
  }

  const mapDay = (di: number, fn: (d: ItineraryV3['days'][number]) => ItineraryV3['days'][number]) =>
    edit((p) => ({ ...p, days: p.days.map((d, i) => (i === di ? fn(d) : d)) }))

  const patchAct = (di: number, ai: number, patch: Partial<ActivityV3>) =>
    mapDay(di, (d) => ({ ...d, activities: d.activities.map((a, j) => (j === ai ? { ...a, ...patch } : a)) }))

  const removeAct = (di: number, ai: number) =>
    mapDay(di, (d) => ({ ...d, activities: d.activities.filter((_, j) => j !== ai) }))

  const moveAct = (di: number, ai: number, dir: -1 | 1) =>
    mapDay(di, (d) => {
      const next = [...d.activities]
      const to = ai + dir
      if (to < 0 || to >= next.length) return d
      ;[next[ai], next[to]] = [next[to], next[ai]]
      return { ...d, activities: next }
    })

  const addAct = (di: number) =>
    mapDay(di, (d) => ({
      ...d,
      activities: [...d.activities, { slot: nextActivitySlot(d.activities), name: { en: '', th: '' } }],
    }))

  /** Insert a sibling with the SAME slot right after this row — that adjacency
   *  IS what makes a meal slot a pick-one choice (V3 has no nested options). */
  const addOption = (di: number, ai: number) =>
    mapDay(di, (d) => {
      const next = [...d.activities]
      next.splice(ai + 1, 0, { slot: d.activities[ai].slot, name: { en: '', th: '' } })
      return { ...d, activities: next }
    })

  /** Pick one option of a choice: `selected` on this row, cleared on its
   *  same-slot neighbours. (`is_default` is the ADMIN's ⭐ — untouched here.) */
  function pickOption(di: number, ai: number) {
    mapDay(di, (d) => {
      const slot = d.activities[ai].slot
      const group = groupBounds(d.activities, ai)
      return {
        ...d,
        activities: d.activities.map((a, j) =>
          j >= group.start && j < group.end && a.slot === slot ? { ...a, selected: j === ai ? true : null } : a,
        ),
      }
    })
  }

  // ── Covers ────────────────────────────────────────────────────────────────
  // `cover_images` and `cover_places` are POSITIONAL: caption i belongs to image
  // i, so both arrays are edited together or the captions slide off their photos.
  const covers = itin.overview?.cover_images ?? []
  const places = itin.overview?.cover_places ?? []

  const setCovers = (images: string[], captions: string[]) =>
    edit((p) => ({ ...p, overview: { ...p.overview, cover_images: images, cover_places: captions } }))

  const addCover = (url: string) => setCovers([...covers, url], [...places, ''])
  const removeCover = (i: number) =>
    setCovers(covers.filter((_, j) => j !== i), places.filter((_, j) => j !== i))
  const setCaption = (i: number, text: string) =>
    setCovers(covers, Array.from({ length: covers.length }, (_, j) => (j === i ? text : places[j] ?? '')))
  const moveCover = (i: number, dir: -1 | 1) => {
    const to = i + dir
    if (to < 0 || to >= covers.length) return
    const img = [...covers]
    const cap = Array.from({ length: covers.length }, (_, j) => places[j] ?? '')
    ;[img[i], img[to]] = [img[to], img[i]]
    ;[cap[i], cap[to]] = [cap[to], cap[i]]
    setCovers(img, cap)
  }

  const addDay = () =>
    edit((p) => ({
      ...p,
      days: [...p.days, { day: p.days.length + 1, name: { en: '', th: '' }, activities: [] }],
    }))

  const removeDay = (di: number) => edit((p) => ({ ...p, days: p.days.filter((_, i) => i !== di) }))

  /** Keyboard/accessible equivalent of dragging — Reorder is pointer-only. */
  const moveDay = (di: number, dir: -1 | 1) =>
    edit((p) => {
      const to = di + dir
      if (to < 0 || to >= p.days.length) return p
      const days = [...p.days]
      ;[days[di], days[to]] = [days[to], days[di]]
      return { ...p, days }
    })

  /**
   * `day` numbers (and totalDays) are normalized ONLY here, on save.
   *
   * Renumbering as you drag would change each day's React key mid-gesture,
   * remounting the card and killing the animation. So position is display-only
   * while editing — the badge shows the index — and the stored `day` is brought
   * back to 1..n at the moment it leaves the browser, which is the only time
   * anything else (renderer, date derivation from startDate + index) reads it.
   */
  function payload(): ItineraryV3 {
    const days = itin.days.map((d, i) => ({ ...d, day: i + 1 }))
    return { ...itin, days, totalDays: days.length }
  }

  return (
    <div className="space-y-4 font-detail">
      {/* ── Trip level ─────────────────────────────────────────────────────── */}
      <section className="space-y-3 rounded-3xl bg-white p-5 shadow-sm">
        <div>
          <label className={`mb-1.5 block ${label}`}>ชื่อทริป · Trip name</label>
          <input
            value={title}
            onChange={(e) => { setTitle(e.target.value); setDirty(true) }}
            placeholder="ตั้งชื่อทริปของคุณ"
            className={`${field} font-semibold`}
          />
        </div>
        <div>
          <label className={`mb-1.5 flex items-center gap-1.5 ${label}`}>
            <CalendarDays size={12} strokeWidth={2.5} /> วันเริ่มเดินทาง · Start date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setDirty(true) }}
            className={field}
          />
        </div>
        {/* Notes — the SAME field as the ✏️ on the trip card's back face
            (overview.description). Both routes write one place, so an edit made
            in either shows in the other. */}
        <div>
          <label className={`mb-1.5 block ${label}`}>โน้ต · Notes</label>
          <textarea
            value={itin.overview?.description ?? ''}
            onChange={(e) => edit((p) => ({ ...p, overview: { ...p.overview, description: e.target.value } }))}
            rows={5}
            placeholder="เช่น ของที่ต้องเตรียม, ร้านที่อยากลอง, เบอร์ติดต่อ"
            className={`${field} resize-y leading-relaxed`}
          />
        </div>
      </section>

      {/* ── Covers ─────────────────────────────────────────────────────────
          The hero carousel on the trip card and in the trip modal. Image order
          is the carousel order, and the caption under each photo is its
          `cover_places` entry — the first image is what the card shows. */}
      <section className="space-y-3 rounded-3xl bg-white p-5 shadow-sm">
        <div>
          <p className={label}>รูปหน้าปก · Cover photos</p>
          <p className="mt-1 text-[11px] text-graphite/50">
            รูปแรกคือรูปที่ขึ้นบนการ์ดทริป · ชื่อสถานที่จะแสดงใต้รูปในแกลเลอรี
          </p>
        </div>

        {/* Compact rows: a 44px thumb and a single-line field. The caption is
            the only thing here that needs width, so the chrome around it stays
            small — at 56px + gap-3 the text clipped mid-word. */}
        {covers.length > 0 && (
          <ul className="space-y-1.5">
            {covers.map((c, i) => (
              <li key={`${c}-${i}`} className="flex items-center gap-2 rounded-2xl bg-briefing-cream p-2">
                <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-zen-black/5">
                  <Image src={resolveCoverImage(c, `${i}`)} alt="" fill sizes="44px" className="object-cover" />
                </span>
                <input
                  value={places[i] ?? ''}
                  onChange={(e) => setCaption(i, e.target.value)}
                  placeholder="ชื่อสถานที่ในรูป · e.g. Tokyo Tower"
                  className={`${field} min-w-0 flex-1 px-2.5 py-1 text-[13px]`}
                />
                <div className="flex shrink-0 items-center">
                  <button type="button" onClick={() => moveCover(i, -1)} disabled={i === 0} className="p-0.5 text-graphite/40 transition-colors hover:text-basel-brick disabled:opacity-20" aria-label="เลื่อนรูปขึ้น">
                    <ArrowUp size={13} strokeWidth={2.5} />
                  </button>
                  <button type="button" onClick={() => moveCover(i, 1)} disabled={i === covers.length - 1} className="p-0.5 text-graphite/40 transition-colors hover:text-basel-brick disabled:opacity-20" aria-label="เลื่อนรูปลง">
                    <ArrowDown size={13} strokeWidth={2.5} />
                  </button>
                  <button type="button" onClick={() => removeCover(i)} className="p-0.5 text-graphite/40 transition-colors hover:text-red-600" aria-label="ลบรูป">
                    <X size={14} strokeWidth={2.5} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Upload APPENDS: CoverUpload owns one value, so it is cleared right
            after each upload and reused as the "add another" control. */}
        <CoverUpload
          value={null}
          onChange={(url) => { if (url) addCover(url) }}
          label="เพิ่มรูปหน้าปก · Add a cover photo"
        />
      </section>

      {/* ── Days ─────────────────────────────────────────────────────────────
          Drag to reorder (motion/react's Reorder — already a dependency, and
          touch-capable, so no drag library is pulled in). The plan is NOT
          checked afterwards: a route whose transport no longer connects is the
          traveller's own call (owner decision, 2026-08-08).

          `dragListener={!isOpen}` — a COLLAPSED card is draggable anywhere on
          it; an OPEN one is not draggable at all, so a drag can never start on
          a text field you were trying to select. The ↑/↓ buttons work in both
          states and cover keyboard/assistive use, which pointer drag can't. */}
      <Reorder.Group axis="y" values={itin.days} onReorder={(days) => edit((p) => ({ ...p, days }))} className="space-y-4">
      {itin.days.map((day, di) => {
        const isOpen = openDay === day.day
        return (
          <Reorder.Item
            key={day.day}
            value={day}
            as="section"
            dragListener={!isOpen}
            className={`overflow-hidden rounded-3xl bg-white shadow-sm ${isOpen ? '' : 'cursor-grab active:cursor-grabbing'}`}
          >
            {/* Day header — tap to open. The number badge doubles as the marker
                that will become the drag handle when reordering lands. */}
            <div className="flex items-center gap-3 border-b border-zen-black/10 bg-briefing-cream px-4 py-3">
              <button
                type="button"
                onClick={() => setOpenDay(isOpen ? null : day.day)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                {/* The badge shows POSITION (index), not the stored `day` —
                    which is only normalized on save (see payload()). */}
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-basel-brick text-sm font-black text-white">
                  {String(di + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-zen-black">
                    {day.name?.th || day.name?.en || `วันที่ ${day.day}`}
                  </span>
                  <span className="block text-[11px] text-graphite/60">{day.activities.length} รายการ</span>
                </span>
                {/* Disclosure = a chevron that ROTATES from ▸ to ▾ (the app's
                    existing accordion vocabulary). It used to be a down-chevron,
                    which is the same glyph as the "move down" button two inches
                    to its right — two different actions wearing one icon. */}
                <ChevronRight
                  size={16}
                  className={`shrink-0 text-graphite/40 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                />
              </button>
              {itin.days.length > 1 && (
                <div className="flex shrink-0 items-center">
                  {/* ARROWS for movement, chevrons for disclosure — the one
                      distinction that keeps the two readable side by side. */}
                  <button type="button" onClick={() => moveDay(di, -1)} disabled={di === 0} className="p-1 text-graphite/40 transition-colors hover:text-basel-brick disabled:opacity-20" aria-label="เลื่อนวันขึ้น">
                    <ArrowUp size={14} strokeWidth={2.5} />
                  </button>
                  <button type="button" onClick={() => moveDay(di, 1)} disabled={di === itin.days.length - 1} className="p-1 text-graphite/40 transition-colors hover:text-basel-brick disabled:opacity-20" aria-label="เลื่อนวันลง">
                    <ArrowDown size={14} strokeWidth={2.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeDay(di)}
                    aria-label={`ลบวันที่ ${di + 1}`}
                    className="p-1 text-graphite/40 transition-colors hover:text-red-600"
                  >
                    <Trash2 size={15} strokeWidth={2.25} />
                  </button>
                  {/* Grip: a visual cue only — the whole collapsed card drags. */}
                  <GripVertical
                    size={15}
                    aria-hidden
                    className={`ml-0.5 transition-opacity ${isOpen ? 'opacity-0' : 'text-graphite/30'}`}
                  />
                </div>
              )}
            </div>

            <AnimatePresence initial={false}>
            {isOpen && (
              <motion.div {...collapse}>
              <div className="space-y-2 p-3 sm:p-4">
                {/* Day name (bilingual) */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    value={day.name?.en ?? ''}
                    onChange={(e) => mapDay(di, (d) => ({ ...d, name: { ...d.name, en: e.target.value } }))}
                    placeholder="ชื่อวัน (EN)"
                    className={`${field} py-1.5`}
                  />
                  <input
                    value={day.name?.th ?? ''}
                    onChange={(e) => mapDay(di, (d) => ({ ...d, name: { ...d.name, th: e.target.value } }))}
                    placeholder="ชื่อวัน (TH)"
                    className={`${field} py-1.5`}
                  />
                </div>

                {/* Day highlight — what the Overview's "Day Highlights" list and
                    the Itinerary tab's day header show. Left empty it DERIVES
                    from the day's Must/Recommend activities, so the placeholder
                    shows what you'd get; typing here overrides that. */}
                <div>
                  <label className={`mb-1.5 block ${label}`}>ไฮไลต์ของวัน · Day highlight</label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      value={day.highlight?.en ?? ''}
                      onChange={(e) => mapDay(di, (d) => ({ ...d, highlight: { en: e.target.value, th: d.highlight?.th ?? '' } }))}
                      placeholder="ไฮไลต์ (EN)"
                      className={`${field} py-1.5`}
                    />
                    <input
                      value={day.highlight?.th ?? ''}
                      onChange={(e) => mapDay(di, (d) => ({ ...d, highlight: { en: d.highlight?.en ?? '', th: e.target.value } }))}
                      placeholder={derivedHighlight(day) || 'ไฮไลต์ (TH)'}
                      className={`${field} py-1.5`}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-graphite/50">
                    เว้นว่างไว้ = ระบบสรุปให้เองจากกิจกรรมที่ตั้งเป็น Must / Recommend
                  </p>
                </div>

                {day.activities.length === 0 && (
                  <p className="py-2 text-center text-xs text-graphite/50">ยังไม่มีกิจกรรมในวันนี้</p>
                )}

                {day.activities.map((a, ai) => {
                  const key = `${di}-${ai}`
                  const open = openAct === key
                  const group = groupBounds(day.activities, ai)
                  const isChoice = MEALS.has(a.slot) && group.end - group.start > 1
                  return (
                    <div key={key} className="overflow-hidden rounded-2xl border border-zen-black/10 bg-briefing-cream/40">
                      <div className="flex items-center gap-2 px-2.5 py-2 sm:px-3">
                        {/* MOBILE: the meta (time · slot · badges) takes line 1
                            and the NAME wraps to line 2 at full width. On one
                            line the name was squeezed between a 44px time, a
                            slot chip and three buttons — down to ~40px, i.e.
                            "Ya…", which made rows unidentifiable. sm+ keeps the
                            original single-line row. */}
                        <button
                          type="button"
                          onClick={() => setOpenAct(open ? null : key)}
                          className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-left sm:flex-nowrap"
                        >
                          <ChevronRight size={14} className={`shrink-0 text-graphite/40 transition-transform ${open ? 'rotate-90' : ''}`} />
                          <span className="w-10 shrink-0 text-[11px] font-bold text-basel-brick/80 sm:w-11">{a.time || '--:--'}</span>
                          <span className="shrink-0 rounded-full bg-zen-black/5 px-2 py-0.5 text-[9px] font-semibold text-graphite/70 sm:text-[10px]">
                            {isChoice ? (MEAL_LABEL[a.slot] ?? a.slot) : a.slot}
                          </span>
                          {/* ⭐ = the admin recommended this option; ✓ = your pick. */}
                          {a.is_default && <Star size={11} className="shrink-0 fill-amber-400 text-amber-400" />}
                          {a.selected && <Check size={12} className="shrink-0 text-basel-brick" strokeWidth={3} />}
                          <span className="w-full min-w-0 truncate pl-6 text-[13px] font-bold text-zen-black sm:w-auto sm:flex-1 sm:pl-0 sm:text-sm">
                            {nameOf(a)}
                          </span>
                        </button>
                        <div className="flex shrink-0 items-center">
                          <button type="button" onClick={() => moveAct(di, ai, -1)} disabled={ai === 0} className="p-1 text-graphite/40 transition-colors hover:text-basel-brick disabled:opacity-20" aria-label="เลื่อนขึ้น">
                            <ArrowUp size={13} strokeWidth={2.5} />
                          </button>
                          <button type="button" onClick={() => moveAct(di, ai, 1)} disabled={ai === day.activities.length - 1} className="p-1 text-graphite/40 transition-colors hover:text-basel-brick disabled:opacity-20" aria-label="เลื่อนลง">
                            <ArrowDown size={13} strokeWidth={2.5} />
                          </button>
                          <button type="button" onClick={() => removeAct(di, ai)} className="p-1 text-graphite/40 transition-colors hover:text-red-600" aria-label="ลบรายการ">
                            <X size={14} strokeWidth={2.5} />
                          </button>
                        </div>
                      </div>

                      {/* Choice controls — only on a meal row that has same-slot
                          neighbours, i.e. an actual pick-one group. */}
                      {MEALS.has(a.slot) && (
                        <div className="flex flex-wrap items-center gap-2 px-2.5 pb-2 sm:px-3">
                          {isChoice && (
                            <button
                              type="button"
                              onClick={() => pickOption(di, ai)}
                              className={`${pill} ${
                                a.selected
                                  ? 'bg-basel-brick text-white'
                                  : 'border border-zen-black/15 bg-white text-graphite hover:border-basel-brick/50 hover:text-basel-brick'
                              }`}
                            >
                              {a.selected ? <><Check size={12} strokeWidth={3} /> เลือกไว้</> : 'เลือกร้านนี้'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => addOption(di, ai)}
                            className={`${pill} border border-dashed border-zen-black/20 text-graphite/70 hover:border-basel-brick hover:text-basel-brick`}
                          >
                            <Plus size={12} strokeWidth={2.5} /> เพิ่มตัวเลือก
                          </button>
                        </div>
                      )}

                      <AnimatePresence initial={false}>
                        {open && (
                          <motion.div {...collapse}>
                            <div className="border-t border-zen-black/10 px-3 pb-3 pt-2">
                              <ActivityFields
                                a={a}
                                mode="traveller"
                                siblings={day.activities}
                                selfIndex={ai}
                                onPatch={(p) => patchAct(di, ai, p)}
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}

                <button
                  type="button"
                  onClick={() => addAct(di)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-full border border-dashed border-zen-black/20 py-2 text-xs font-semibold text-graphite/70 transition-colors hover:border-basel-brick hover:text-basel-brick"
                >
                  <Plus size={13} strokeWidth={2.5} /> เพิ่มกิจกรรม
                </button>
              </div>
              </motion.div>
            )}
            </AnimatePresence>
          </Reorder.Item>
        )
      })}
      </Reorder.Group>

      <button
        type="button"
        onClick={addDay}
        className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-dashed border-zen-black/20 py-2.5 text-sm font-semibold text-graphite/70 transition-colors hover:border-basel-brick hover:text-basel-brick"
      >
        <Plus size={14} strokeWidth={2.5} /> เพิ่มวัน
      </button>

      {/* ── Save ───────────────────────────────────────────────────────────── */}
      <div className="sticky bottom-4 pt-2">
        <button
          type="button"
          onClick={() => { setDirty(false); onSave({ itinerary: payload(), startDate, title: title.trim() || initialTitle }) }}
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-zen-black py-3.5 text-sm font-semibold text-white shadow-lg shadow-zen-black/25 transition-colors hover:bg-basel-brick disabled:opacity-50"
        >
          <Save size={15} strokeWidth={2.5} />
          {saving ? 'กำลังบันทึก...' : dirty ? 'บันทึกการแก้ไข · Save changes' : 'บันทึก · Saved'}
        </button>
      </div>
    </div>
  )
}

/** What this day's highlight would say if the authored fields were left empty —
 *  used as the placeholder, so the field shows its own fallback. */
function derivedHighlight(day: ItineraryV3['days'][number]): string {
  return v3DayHighlight({ ...day, highlight: undefined }).names.join(' · ')
}

/** Bounds of the adjacent same-slot run containing `ai` — the run IS the choice
 *  group (V3 stores options as neighbouring rows, not a nested list). */
function groupBounds(acts: ActivityV3[], ai: number): { start: number; end: number } {
  const slot = acts[ai].slot
  let start = ai
  let end = ai + 1
  while (start > 0 && acts[start - 1].slot === slot) start--
  while (end < acts.length && acts[end].slot === slot) end++
  return { start, end }
}
