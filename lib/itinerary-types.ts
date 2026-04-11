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
}

// ── Day ─────────────────────────────────────────────────────────────────────

export interface Day {
  day: number
  location: string
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

// ── Itinerary ───────────────────────────────────────────────────────────────

export interface Itinerary {
  title?: string
  totalDays?: number
  season?: string
  days: Day[]
  shareCode?: string | null
  /** Optional description shown on template cards */
  description?: string
}

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
