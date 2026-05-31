/**
 * Canonical itinerary data model — single source of truth.
 *
 * Every file that reads or writes itinerary JSON should import from here.
 * The interfaces are designed for backward compatibility: all new fields
 * are optional with sensible defaults, so old itineraries render unchanged.
 *
 * Priority system:
 *   - 'mandatory' = missing this could cause problems or money loss
 *     (flights, hotel check-in, reserved trains, airport transfer)
 *   - 'recommended' = should do unless you have a reason not to
 *     (popular attractions with timing constraints)
 *   - 'optional' = nice-to-have, skip if tired or running late
 *     (specific restaurants, shopping areas, secondary attractions)
 *
 * Choices system:
 *   Activities within a Choice group are alternatives — the user picks one
 *   that fits their preference/budget/lifestyle. Great for restaurants,
 *   hotels, and rainy-day backups.
 */

// ── Activity ────────────────────────────────────────────────────────────────

export type ActivityPriority = 'mandatory' | 'recommended' | 'optional'

export type ActivityCategory =
  | 'flight'
  | 'transport'
  | 'sightseeing'
  | 'food'
  | 'shopping'
  | 'accommodation'
  | 'experience'
  | 'other'

export interface Activity {
  time: string
  name: string
  notes?: string
  /** Default: 'optional' for backward compat with old itineraries */
  priority?: ActivityPriority
  /** Visual category badge (flight ✈️, food 🍜, etc.) */
  category?: ActivityCategory
  /** Estimated cost hint (e.g. "¥1,500", "Free", "¥3,000-5,000") */
  cost?: string
  /** Duration hint (e.g. "1.5h", "30min") */
  duration?: string
  /** Thai name (v2 node snapshots carry this). */
  nameTh?: string | null
  /** Emoji from the node's category (v2). Shown instead of CategoryIcon when present. */
  emoji?: string | null
  /** Google Maps link (v2 nodes). */
  mapUrl?: string | null
}

// ── Choice ──────────────────────────────────────────────────────────────────

export interface Choice {
  /** What this choice is about (e.g. "Lunch near Fushimi Inari") */
  label: string
  /** 2–4 alternative activities to pick from */
  options: Activity[]
  /** Priority of the choice group itself */
  priority?: ActivityPriority
  /** Category for the whole group */
  category?: ActivityCategory
  /** Index into `options` the user picked when customizing their copy (non-destructive). */
  selected?: number
}

// ── Day ─────────────────────────────────────────────────────────────────────

export interface Day {
  day: number
  location: string
  /** Appended "free day" — trip window is longer than the plan; user fills it in. */
  free?: boolean
  activities: Activity[]
  /** Pick-one-of-N alternatives for this day (restaurants, attractions, etc.) */
  choices?: Choice[]
  accommodation: string | null
  /** Alternative hotel/accommodation options (budget/mid/luxury tiers) */
  accommodationChoices?: Array<{
    name: string
    tier?: string   // e.g. "Budget", "Mid-range", "Luxury"
    cost?: string   // e.g. "¥3,000/night"
    notes?: string
  }>
  transport: string
  /** Extra transport notes (e.g. "Buy Suica card at airport", "Last train 23:15") */
  transportNotes?: string
}

// ── Availability ──────────────────────────────────────────────────────────────
// Seasonal availability for a pre-planned trip. Day-precise but YEAR-AGNOSTIC:
// dates are stored as "MM-DD" strings so a window applies to every year.
// Drives the /pre-planned date filter (see lib/availability.ts).

/**
 * A year-agnostic date range, inclusive on both ends, as "MM-DD" strings.
 * If `to` is calendar-earlier than `from`, the range WRAPS the new year —
 * e.g. snow season { from: "12-01", to: "02-28" } means Dec 1 → Feb 28.
 */
export interface DateRange {
  from: string // "MM-DD", e.g. "04-27"
  to: string // "MM-DD", e.g. "11-15"
}

export interface TripAvailability {
  /** When nothing inside the trip is closed. Empty array = always available. */
  available: DateRange[]
  /** The best time(s) to go — can be multiple (e.g. spring + autumn). */
  recommended: DateRange[]
  /** Optional human note shown on the card (bilingual encouraged). */
  note?: string
}

// ── Itinerary ───────────────────────────────────────────────────────────────

export interface Itinerary {
  title?: string
  totalDays?: number
  season?: string
  days: Day[]
  shareCode?: string | null
  /** Optional description shown on template cards */
  description?: string
  /** Absent/1 = legacy flat shape. 2 = node/slot shape (see below). */
  version?: number
}

// ── v2 node/slot model (docs/node-architecture-spec.md) ──────────────────────
// A trip stays one self-contained jsonb document, but days are organized into
// canonical meal slots + a flexible activity timeline + accommodation + transport,
// each holding frozen NodeSnap copies of library nodes. lib/trips/itinerary-model.ts
// normalizes v1 OR v2 into the v1 render shape so consumers stay simple.

/** A frozen copy of a library Node at the moment it was added to a trip. */
export interface NodeSnap {
  /** Provenance back to the Node library; null for ad-hoc (typed-in) places. */
  nodeId?: string | null
  name: string
  nameTh?: string | null
  categoryCode: string
  /** Denormalized from the node's Category for render-without-join. */
  emoji?: string | null
  notes?: string | null
  cost?: string | null
  duration?: string | null
  time?: string | null
  mapUrl?: string | null
  placeId?: string | null
}

/** A slot is empty (null), one node, or a pick-one-of-N choice. */
export type Slot =
  | { kind: 'single'; node: NodeSnap }
  | { kind: 'choice'; label?: string; selected?: number | null; options: NodeSnap[] }

/** Canonical meal slots — keys ALWAYS present so the LLM can say "not scheduled". */
export interface Meals {
  breakfast: Slot | null
  lunch: Slot | null
  dinner: Slot | null
}

export interface ActivityV2 {
  time?: string | null
  priority?: ActivityPriority
  node: NodeSnap
}

export interface TransportLeg {
  from?: string | null
  to?: string | null
  notes?: string | null
  node?: NodeSnap | null
}

export interface DayV2 {
  day: number
  location: string
  free?: boolean
  meals: Meals
  activities: ActivityV2[]
  accommodation: Slot | null
  transport: TransportLeg[]
}

export interface ItineraryV2 {
  version: 2
  title?: string
  totalDays?: number
  season?: string
  days: DayV2[]
  shareCode?: string | null
  description?: string
}

export type AnyItinerary = Itinerary | ItineraryV2

// ── Display helpers ──────────────────────────────────────────────────────────
// Icon mapping is NOT here — it lives in the React component layer
// (app/components/CategoryIcon.tsx) because lucide icons are React components
// and this file is a pure types/constants module that can be imported anywhere
// (including server code that can't use JSX).

export const CATEGORY_LABEL: Record<ActivityCategory, string> = {
  flight: 'Flight',
  transport: 'Transport',
  sightseeing: 'Sightseeing',
  food: 'Food & Drink',
  shopping: 'Shopping',
  accommodation: 'Check-in',
  experience: 'Experience',
  other: 'Activity',
}

export const PRIORITY_LABEL: Record<ActivityPriority, string> = {
  mandatory: 'Must-do',
  recommended: 'Recommended',
  optional: 'Optional',
}
