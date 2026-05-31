import type {
  Itinerary, ItineraryV2, AnyItinerary, Day, DayV2, Activity, Choice, ActivityCategory,
  ActivityPriority, NodeSnap, Slot, Meals,
} from '@/lib/itinerary-types'

/**
 * Itinerary compat layer (Phase N3 — docs/node-architecture-spec.md).
 *
 * A trip's jsonb is either v1 (flat `activities` + `choices`) or v2 (node/slot:
 * `meals` + node-wrapped `activities` + accommodation/transport slots). Every
 * READER (ItineraryView, injector, exporter) goes through `getRenderDays`, which
 * returns the v1 `Day[]` render shape for BOTH versions — so consumers never
 * branch on version. `migrateV1toV2` powers the one-off N5 migration.
 */

// ── version detection ────────────────────────────────────────────────────────

export function isV2(itin: unknown): itin is ItineraryV2 {
  return !!itin && typeof itin === 'object' && (itin as { version?: number }).version === 2
}

// ── category code ↔ v1 enum ──────────────────────────────────────────────────

/** v2 categoryCode → coarse v1 enum (for the CategoryIcon when no emoji). */
export function categoryForCode(code: string | undefined | null): ActivityCategory {
  if (!code) return 'other'
  if (code.startsWith('log.air')) return 'flight'
  if (code.startsWith('log.')) return 'transport'
  if (code.startsWith('live.')) return 'accommodation'
  if (code.startsWith('food.')) return 'food'
  if (code.startsWith('exp.act')) return 'experience'
  if (code.startsWith('exp.')) return 'sightseeing'
  if (code.startsWith('shop.')) return 'shopping'
  return 'other'
}

/** v1 enum → a sensible default v2 categoryCode (for migration; lossy). */
function codeForCategory(cat: ActivityCategory | undefined): string {
  switch (cat) {
    case 'flight': return 'log.air.domestic'
    case 'transport': return 'log.rail.metro'
    case 'food': return 'food.dine.restaurant'
    case 'sightseeing': return 'exp.land.nature'
    case 'shopping': return 'shop.mall'
    case 'accommodation': return 'live.stay.hotel'
    case 'experience': return 'exp.act.workshop'
    default: return 'exp.act.strolling'
  }
}

const MEAL = {
  breakfast: { emoji: '🍳', th: 'มื้อเช้า', en: 'Breakfast', kws: ['เช้า', 'breakfast', 'มื้อเช้า'] },
  lunch: { emoji: '🍱', th: 'มื้อกลางวัน', en: 'Lunch', kws: ['กลางวัน', 'lunch', 'เที่ยง'] },
  dinner: { emoji: '🍽️', th: 'มื้อเย็น', en: 'Dinner', kws: ['เย็น', 'dinner', 'ค่ำ', 'มื้อเย็น'] },
} as const
type MealKey = keyof typeof MEAL

// ── v2 → v1 render shape ─────────────────────────────────────────────────────

function nodeToActivity(
  n: NodeSnap,
  opts?: { time?: string | null; priority?: ActivityPriority; tag?: string }
): Activity {
  const notes = opts?.tag ? [opts.tag, n.notes].filter(Boolean).join(' — ') : n.notes ?? undefined
  return {
    time: opts?.time ?? n.time ?? '',
    name: n.name,
    nameTh: n.nameTh ?? null,
    notes: notes || undefined,
    priority: opts?.priority,
    category: categoryForCode(n.categoryCode),
    emoji: n.emoji ?? null,
    cost: n.cost ?? undefined,
    duration: n.duration ?? undefined,
    mapUrl: n.mapUrl ?? null,
  }
}

function byTime(a: Activity, b: Activity): number {
  const ta = (a.time ?? '').trim()
  const tb = (b.time ?? '').trim()
  if (ta && tb) return ta.localeCompare(tb)
  if (ta) return -1
  if (tb) return 1
  return 0
}

function v2DayToRenderDay(d: DayV2): Day {
  const activities: Activity[] = []
  const choices: Choice[] = []

  // Meals: single → timeline activity (with a meal tag); choice → a choice group.
  ;(Object.keys(MEAL) as MealKey[]).forEach((key) => {
    const slot = d.meals?.[key]
    if (!slot) return
    const m = MEAL[key]
    if (slot.kind === 'single') {
      activities.push(nodeToActivity(slot.node, { tag: `${m.emoji} ${m.th}` }))
    } else {
      choices.push({
        label: `${m.emoji} ${m.th} · ${m.en}`,
        category: 'food',
        selected: slot.selected ?? undefined,
        options: slot.options.map((n) => nodeToActivity(n)),
      })
    }
  })

  for (const a of d.activities ?? []) {
    activities.push(nodeToActivity(a.node, { time: a.time ?? a.node.time, priority: a.priority }))
  }
  activities.sort(byTime)

  let accommodation: string | null = null
  let accommodationChoices: Day['accommodationChoices']
  const acc = d.accommodation
  if (acc?.kind === 'single') accommodation = acc.node.name
  else if (acc?.kind === 'choice') {
    accommodationChoices = acc.options.map((n) => ({
      name: n.name, cost: n.cost ?? undefined, notes: n.notes ?? undefined,
    }))
  }

  const transport =
    (d.transport ?? [])
      .map((leg) => {
        const route = [leg.from, leg.to].filter(Boolean).join(' → ')
        const via = leg.node ? `${leg.node.emoji ?? ''} ${leg.node.name}`.trim() : ''
        return [route, via, leg.notes].filter(Boolean).join(' · ')
      })
      .filter(Boolean)
      .join('\n') // '' when no legs → ItineraryView skips it (falsy)

  return {
    day: d.day, location: d.location, free: d.free,
    activities, choices, accommodation, accommodationChoices, transport,
  }
}

/** v1 days as-is; v2 days converted to the v1 render shape. Empty array if no days. */
export function getRenderDays(itinerary: AnyItinerary | null | undefined): Day[] {
  if (!itinerary || typeof itinerary !== 'object') return []
  if (isV2(itinerary)) return (itinerary.days ?? []).map(v2DayToRenderDay)
  const days = (itinerary as Itinerary).days
  return Array.isArray(days) ? days : []
}

// ── v1 → v2 migration (Phase N5) ─────────────────────────────────────────────

function activityToNode(a: Activity): NodeSnap {
  return {
    nodeId: null,
    name: a.name,
    nameTh: a.nameTh ?? null,
    categoryCode: codeForCategory(a.category),
    emoji: a.emoji ?? null,
    notes: a.notes ?? null,
    cost: a.cost ?? null,
    duration: a.duration ?? null,
    time: a.time || null,
    mapUrl: a.mapUrl ?? null,
  }
}

function detectMeal(label: string | undefined): MealKey | null {
  const l = (label ?? '').toLowerCase()
  for (const key of Object.keys(MEAL) as MealKey[]) {
    if (MEAL[key].kws.some((k) => l.includes(k))) return key
  }
  return null
}

function v1DayToV2Day(d: Day): DayV2 {
  const meals: Meals = { breakfast: null, lunch: null, dinner: null }
  const leftoverChoiceActs: Activity[] = []

  for (const c of d.choices ?? []) {
    const key = detectMeal(c.label)
    const slot: Slot = {
      kind: 'choice',
      label: c.label,
      selected: c.selected ?? null,
      options: (c.options ?? []).map(activityToNode),
    }
    if (key && !meals[key]) meals[key] = slot
    else {
      // Non-meal (or duplicate) choice → fall back to its selected/first option as an activity.
      const pick = c.options?.[c.selected ?? 0]
      if (pick) leftoverChoiceActs.push(pick)
    }
  }

  const activities = [...(d.activities ?? []), ...leftoverChoiceActs].map((a) => ({
    time: a.time || null,
    priority: a.priority,
    node: activityToNode(a),
  }))

  let accommodation: Slot | null = null
  if (d.accommodationChoices && d.accommodationChoices.length > 0) {
    accommodation = {
      kind: 'choice',
      options: d.accommodationChoices.map((o) => ({
        nodeId: null, name: o.name, categoryCode: 'live.stay.hotel',
        cost: o.cost ?? null, notes: o.notes ?? null,
      })),
    }
  } else if (d.accommodation) {
    accommodation = {
      kind: 'single',
      node: { nodeId: null, name: d.accommodation, categoryCode: 'live.stay.hotel' },
    }
  }

  const transport = d.transport
    ? [{
        from: null, to: null,
        notes: [d.transport, d.transportNotes].filter(Boolean).join(' · ') || null,
        node: null,
      }]
    : []

  return { day: d.day, location: d.location, free: d.free, meals, activities, accommodation, transport }
}

/** Convert a v1 itinerary to v2. Idempotent: returns v2 inputs unchanged. */
export function migrateV1toV2(itinerary: AnyItinerary): ItineraryV2 {
  if (isV2(itinerary)) return itinerary
  const v1 = itinerary as Itinerary
  return {
    version: 2,
    title: v1.title,
    totalDays: v1.totalDays ?? v1.days?.length,
    season: v1.season,
    shareCode: v1.shareCode ?? null,
    description: v1.description,
    days: (v1.days ?? []).map(v1DayToV2Day),
  }
}
