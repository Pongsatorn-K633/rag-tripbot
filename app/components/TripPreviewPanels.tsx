'use client'

import { CalendarDays, MapPin, Pencil, Sparkles, Plus, Landmark } from 'lucide-react'
import JapanIcon from '@/app/components/JapanIcon'
import type { AnyItinerary, Choice } from '@/lib/itinerary-types'
import { getRenderDays, isV3 } from '@/lib/trips/itinerary-model'

/**
 * Trip-preview tab panels (fullscreen PlanPreviewModal) — ported from the Kimi
 * "Page Design Tweaks" build (sections/OverviewPanel + DayTimeline + TripTabs),
 * which was authored directly in our tokens. Day-chip selection state lives in
 * the modal (the chips render under the tab pill, per that design).
 *
 * STRUCTURE-FIRST MOCK: a template has no travel dates, no distances and no
 * editing, so those render as literal "XX" placeholders / inert buttons until
 * the detail pass (dates arrive on duplication; km needs Maps data; Auto Fill /
 * Add Activity belong to the owned-trip editor).
 *
 * Detail text uses `font-detail` (Plus Jakarta Sans, Thai falls back to Noto).
 */

export type DaySel = number | 'all'

/** One timeline row: a plain activity, or a choice represented by its
 *  recommended/selected option (the preview doesn't expand alternatives). */
type Row = { time?: string; name: string; duration?: string; isChoice?: boolean }

function choiceRow(c: Choice): Row {
  const pick = c.options[c.selected ?? c.recommended ?? 0]
  return { time: c.time, name: pick?.name ?? c.label, duration: pick?.duration, isChoice: true }
}

function dayRows(day: ReturnType<typeof getRenderDays>[number]): Row[] {
  const rows: Row[] = [
    ...day.activities.map((a) => ({ time: a.time, name: a.name, duration: a.duration })),
    ...(day.choices ?? []).map(choiceRow),
  ]
  // Timed rows in clock order; untimed sink to the end.
  return rows.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'))
}

// ── Day chips — rendered by the MODAL under the tab pill (itinerary tab) ─────

export function DayChips({ count, sel, onSel }: { count: number; sel: DaySel; onSel: (v: DaySel) => void }) {
  const chip = (active: boolean) =>
    `shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
      active
        ? 'bg-zen-black text-white shadow-md shadow-zen-black/25'
        : 'border border-zen-black/10 bg-white text-graphite hover:border-basel-brick/50 hover:text-zen-black'
    }`
  return (
    <div className="scrollbar-hide -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 font-detail">
      <button type="button" onClick={() => onSel('all')} className={chip(sel === 'all')}>
        All
      </button>
      {/* Date chips — XX/XX until the trip is duplicated with real dates */}
      {Array.from({ length: count }, (_, i) => (
        <button key={i} type="button" onClick={() => onSel(i + 1)} className={chip(sel === i + 1)}>
          XX/XX
        </button>
      ))}
    </div>
  )
}

// ── Overview tab — Trip summary + Highlights + Traveler note ────────────────

export function OverviewPanel({ itinerary, tripDays }: { itinerary: AnyItinerary; tripDays: number }) {
  const days = getRenderDays(itinerary)
  const v3 = isV3(itinerary) ? itinerary : null
  // Attractions = REAL activities only ("Activity N" slots). Counting every
  // timeline row inflates wildly — 6 meal slots/day + Logistics legs made an
  // 8-day trip read "69 activities". Legacy v1/v2 fall back to plain rows.
  const attractionCount = v3
    ? v3.days.reduce((n, d) => n + (d.activities ?? []).filter((a) => a.slot?.startsWith('Activity')).length, 0)
    : days.reduce((n, d) => n + d.activities.length, 0)
  // Prefectures — derived from the TITLE segments ("Tokyo - Nagano" → 2): the
  // title is authored as the prefecture route by convention. HEURISTIC until
  // the schema carries per-day area codes — day names are creative titles
  // ("All Roads Lead to Matsumoto"), so counting them is hopeless. Legacy
  // v1/v2 fall back to unique day locations.
  const cityCount = v3
    ? new Set(
        v3.title
          .split(/\s*[-–&,]\s*/)
          .map((s) => s.trim())
          .filter(Boolean),
      ).size
    : new Set(days.map((d) => d.location).filter(Boolean)).size
  // Day-by-day highlights, DERIVED (no schema change): each day's Must-priority
  // attractions, falling back to Recommends, then the first attraction. Admins
  // already steer this via the existing priority dropdown. Max 2 per day.
  const dayHighlights = v3
    ? v3.days.map((d) => {
        const acts = (d.activities ?? []).filter((a) => a.slot?.startsWith('Activity'))
        const must = acts.filter((a) => a.priority === 'Must')
        const rec = acts.filter((a) => a.priority === 'Recommend')
        const picks = (must.length ? must : rec.length ? rec : acts).slice(0, 2)
        return { day: d.day, names: picks.map((a) => a.name?.th || a.name?.en || '').filter(Boolean) }
      })
    : days.map((d) => ({ day: d.day, names: d.activities.slice(0, 1).map((a) => a.name) }))
  // Tagline (short cover hook) under the heading; the FULL description stays
  // in the Traveler note card — the schema separates the two on purpose.
  const tagline = v3?.overview.cover_tagline
  const note = v3 ? v3.overview.description : (itinerary as { description?: string }).description

  const stats = [
    { icon: CalendarDays, label: 'Days', value: String(tripDays) },
    { icon: MapPin, label: 'Attractions', value: String(attractionCount) },
    { icon: JapanIcon, label: 'Prefectures', value: String(cityCount || 'XX') },
  ]

  return (
    <div className="space-y-4 font-detail">
      {/* Stats card */}
      <section className="rounded-3xl border border-zen-black/10 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-extrabold tracking-tight text-noir">Trip summary</h2>
        {tagline?.trim() && <p className="mt-0.5 text-sm font-medium text-graphite/70">{tagline}</p>}
        <div className="mt-4 grid grid-cols-3 gap-3">
          {stats.map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-2xl bg-briefing-cream p-3 text-center">
              <Icon className="mx-auto size-5 text-basel-brick" />
              <p className="mt-1.5 text-lg font-extrabold text-zen-black">{value}</p>
              <p className="text-xs font-medium text-graphite/70">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Highlights card — day by day (derived from activity priorities) */}
      {dayHighlights.length > 0 && (
        <section className="rounded-3xl border border-zen-black/10 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-base font-extrabold tracking-tight text-noir">
            <Landmark className="size-4 text-basel-brick" />
            Highlights
          </h3>
          <ul className="mt-3 space-y-2.5">
            {dayHighlights.map((h) => (
              <li key={h.day} className="flex items-start gap-3 text-sm">
                <span className="w-12 shrink-0 pt-px font-bold text-basel-brick">Day {h.day}</span>
                <span className="min-w-0 leading-snug text-graphite">{h.names.join(' · ') || '—'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Traveler note — Midnight card (text-on-dark = briefing-cream, our
          convention; Kimi's build used text-white). XX when the plan has none. */}
      <section className="rounded-3xl bg-zen-black p-5 shadow-lg shadow-zen-black/25">
        <p className="text-sm font-semibold text-briefing-cream/90">Traveler note</p>
        <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-briefing-cream/70">
          {note?.trim() || 'XX'}
        </p>
      </section>
    </div>
  )
}

// ── Itinerary tab — day timelines (chips live in the modal's tab block) ─────

function TimelineItem({ row, isLast }: { row: Row; isLast: boolean }) {
  return (
    <li className="relative grid grid-cols-[3.25rem_1.5rem_1fr]">
      {/* Time */}
      <span className="pt-0.5 text-right text-sm font-medium text-graphite">{row.time || 'XX:XX'}</span>

      {/* Rail */}
      <span className="relative flex justify-center">
        {!isLast && <span className="absolute top-4 h-[calc(100%-0.5rem)] w-0.5 rounded-full bg-basel-brick/25" aria-hidden />}
        <span className="relative z-10 mt-1.5 size-3 shrink-0 rounded-full bg-basel-brick ring-4 ring-basel-brick/20" aria-hidden />
      </span>

      {/* Content */}
      <div className={`flex items-start justify-between gap-3 pl-3 ${isLast ? 'pb-1' : 'pb-6'}`}>
        <div>
          <p className="font-semibold leading-snug text-noir">
            {row.name}
            {row.isChoice && <span className="ml-1.5 text-xs font-medium text-basel-brick">เลือกได้</span>}
          </p>
          <p className="mt-1 text-sm text-graphite/70">
            XX km<span className="mx-1.5 text-basel-brick">•</span>
            {row.duration || 'XX h'}
          </p>
        </div>
        <button
          type="button"
          aria-label={`Edit ${row.name}`}
          className="mt-0.5 shrink-0 text-graphite/40 transition hover:text-zen-black"
        >
          <Pencil className="size-4" />
        </button>
      </div>
    </li>
  )
}

export function ItineraryPanel({ itinerary, sel }: { itinerary: AnyItinerary; sel: DaySel }) {
  const days = getRenderDays(itinerary)
  const shown = sel === 'all' ? days : days.filter((d) => d.day === sel)

  return (
    <div className="space-y-8 font-detail">
      {shown.map((day) => {
        const rows = dayRows(day)
        return (
          <section key={day.day}>
            {/* Day header + (inert, mocked) editor actions */}
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-xl font-extrabold tracking-tight text-noir">Day {day.day}</h2>
                <p className="mt-0.5 text-sm font-medium text-graphite/70">XX</p>
              </div>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-sm font-semibold text-graphite transition hover:text-zen-black"
                >
                  <Sparkles className="size-4 text-basel-brick" />
                  Auto Fill
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1 text-sm font-semibold text-basel-brick transition hover:text-zen-black"
                >
                  <Plus className="size-4" strokeWidth={2.5} />
                  Add Activity
                </button>
              </div>
            </div>

            {/* Timeline */}
            <ul className="mt-5">
              {rows.map((row, i) => (
                <TimelineItem key={i} row={row} isLast={i === rows.length - 1} />
              ))}
            </ul>
            {rows.length === 0 && (
              <p className="mt-4 text-sm text-graphite/60">{day.free ? 'วันว่าง · Free day' : 'XX'}</p>
            )}
          </section>
        )
      })}
    </div>
  )
}
