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
  /** v2: node is a Logistics category → render as a compact transport step, not an activity card. */
  isLogistics?: boolean
  // ── V3 rich fields (optional; surfaced by the redesigned activity card) ──
  location?: string
  rating?: number
  operatingHours?: string
  queueTime?: PlanQueueTime
  bookingPolicy?: PlanBookingPolicy
  howToBook?: string
  /** Must-know "important remark" (how to reach/complete it). */
  remark?: string
  /** Custom walking-route directions URL (distinct from the single-place map pin). */
  walkingUrl?: string | null
  /** Social / website links for the venue. */
  social?: { ig?: string | null; fb?: string | null; tt?: string | null; website?: string | null }
}

// ── Choice ──────────────────────────────────────────────────────────────────

export interface Choice {
  /** What this choice is about (e.g. "Lunch near Fushimi Inari") */
  label: string
  /** Start time (HH:MM) — lets the choice interleave into the timeline by time. */
  time?: string
  /** 2–4 alternative activities to pick from */
  options: Activity[]
  /** Priority of the choice group itself */
  priority?: ActivityPriority
  /** Category for the whole group */
  category?: ActivityCategory
  /** Index into `options` the user picked when customizing their copy (non-destructive). */
  selected?: number
  /** Index of the admin-recommended option (⭐ "แนะนำ") — distinct from the traveler's `selected`. */
  recommended?: number
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
  /** Render-only day-level banner (e.g. "your flight arrives after the plan starts"). */
  notice?: string
}

// ── Availability ──────────────────────────────────────────────────────────────
// Seasonal availability for a pre-planned trip. Day-precise but YEAR-AGNOSTIC:
// dates are stored as "MM-DD" strings so a window applies to every year.
// Drives the /discover date filter (see lib/availability.ts).

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

// ── Flight (per-traveler, captured when duplicating a plan) ──────────────────

export interface FlightLeg {
  /** Airport code or name, e.g. "NRT" / "Narita". */
  airport?: string
  /** Local time, "HH:MM". */
  time?: string
  /** Departure only: the flight leaves the morning AFTER the last itinerary day
   *  (overnight / early-morning red-eye) → it's the next calendar day. Makes the
   *  conflict/tight check exact instead of guessing from the clock. */
  nextDay?: boolean
}

/** The traveler's own flights — stored on their trip copy, not the template. */
export interface TripFlight {
  arrival?: FlightLeg
  departure?: FlightLeg
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
  /** Traveler's flights (added at duplicate time) — renders arrival/departure rows. */
  flight?: TripFlight
  /** Airport codes that make sense for this trip (e.g. ["KIX","ITM"]) — drives the flight picker. */
  airports?: string[]
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

/** Meal slots. breakfast/lunch/dinner are the canonical core — ALWAYS present so
 *  the LLM can say "not scheduled". brunch/afternoon/latenight are optional extras. */
export interface Meals {
  breakfast: Slot | null
  brunch?: Slot | null     // มื้อสาย — late-morning meal
  lunch: Slot | null
  afternoon?: Slot | null  // มื้อบ่าย — café / sweets / light bite
  dinner: Slot | null
  latenight?: Slot | null  // มื้อดึก — post-drinks ramen / izakaya
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
  /** Traveler's flights (added at duplicate time) — renders arrival/departure rows. */
  flight?: TripFlight
  /** Airport codes that make sense for this trip (e.g. ["KIX","ITM"]) — drives the flight picker. */
  airports?: string[]
}

// ── V3: rich pre-planned plan schema ─────────────────────────────────────────
// Mirrors docs/pre-planned-trip/columns.md (the SSOT). Keys stay snake_case to
// match the transformer JSON 1:1, so import is validation, not renaming.

/** Bilingual text — EN and TH say the same thing (see columns.md Thai-style rules). */
export interface Bilingual { en: string; th: string }

export type PlanPriority = 'Must' | 'Recommend' | 'Normal'
export type PlanQueueTime = 'Low' | 'Mid' | 'High' | 'Reserve'
export type PlanBookingPolicy = 'Walk-in Only' | 'Same-Day Ticket' | 'Optional' | 'Recommended' | 'Mandatory'

/** Meal slots (food). */
export const PLAN_MEAL_SLOTS = ['Breakfast', 'Brunch', 'Lunch', 'AfternoonMeal', 'Dinner', 'LatenightMeal'] as const
/** Slots that render as a pick-one carousel — ONLY meals. Activity 1–8 are never
 *  choices; each is its own timeline row. */
export const PLAN_CHOOSABLE_SLOTS = [...PLAN_MEAL_SLOTS] as const
/** All slot values are free-form strings (Logistics | Living | Admin & Services | meal | Activity 1–8). */
export type PlanSlot = string

export interface PlanLinks {
  map?: string | null
  walking_route?: string | null
  ig?: string | null
  fb?: string | null
  tt?: string | null
  website?: string | null
}

export interface ActivityV3 {
  slot: PlanSlot
  is_default?: boolean | null   // admin's ⭐ recommended option (within a meal choice)
  selected?: boolean | null     // the traveler's picked option (set when customizing a copy)
  time?: string | null
  duration_min?: number | null
  priority?: PlanPriority | null
  location?: string | null
  name: Bilingual
  description?: Bilingual | null
  cost?: string | null
  rating?: number | null
  category?: string | null
  operating_hours?: string | null
  queue_time?: PlanQueueTime | null
  booking_policy?: PlanBookingPolicy | null
  how_to_book?: string | null
  maps_api_call?: boolean | null
  placeId?: string | null // resolved Google Place ID (for refreshing Maps data)
  notes?: Bilingual | null
  remark?: Bilingual | null
  links?: PlanLinks | null
}

export interface DayV3 {
  day: number
  name: Bilingual
  activities: ActivityV3[]
  /** Optional authored one-liner for the preview's Day Highlights card.
   *  When absent, the card derives the line from Must/Recommend activities. */
  highlight?: Bilingual
}

/** `popular` — authored editorial flag: shown as a "Popular" badge on the
 *  preview's recommended-period rows. */
export interface PlanPeriod { primary?: string; details?: string; popular?: boolean }
export interface PlanAirport { name: string; code: string }
export interface PlanCarRental {
  primary?: string // "Y" | "N"
  details?: { rentalDuration?: string; byGroupSize?: { size: string; advice: string }[] }
}

/** The overview block (columns.md §1). */
export interface PlanOverview {
  title: string
  /** Short hook shown on the cover card (independent of `description`). */
  cover_tagline?: string
  description?: string
  available_period?: PlanPeriod
  recommended_period?: PlanPeriod[] // one or more "best time to go" windows
  area_code?: string
  cover_images?: string[]
  /** Place name per cover image (same order/index as cover_images) — shown as
   *  the hero chip while swiping the preview's cover gallery. */
  cover_places?: string[]
  available_airports?: { major_hubs?: PlanAirport[] }
  car_rental?: PlanCarRental
  arrival_to_first_act_hrs?: number
  arrival_to_departure_airport_hrs?: number
  logistic_guide_en?: string; logistic_guide_th?: string
  accommodation_guide_en?: string; accommodation_guide_th?: string
  food_guide_en?: string; food_guide_th?: string
  remark_en?: string; remark_th?: string
  queue_guide_en?: string; queue_guide_th?: string
}

export interface HighlightV3 { name: string; description: string; level: string; image?: string | null }

export interface ItineraryV3 {
  version: 3
  // App-compat top-level (derived from overview at import time).
  title: string
  totalDays: number
  season?: string
  airports?: string[]
  shareCode?: string | null
  flight?: TripFlight
  // Rich plan data (matches columns.md / the transformer JSON).
  overview: PlanOverview
  highlights?: HighlightV3[]
  reference_date?: string
  /** Source file this plan was transformed from — stable key for idempotent re-import. */
  sourceFile?: string
  days: DayV3[]
}

export type AnyItinerary = Itinerary | ItineraryV2 | ItineraryV3

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
