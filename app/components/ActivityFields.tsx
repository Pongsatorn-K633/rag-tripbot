'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { ActivityV3, Bilingual, PlanPriority } from '@/lib/itinerary-types'
import { PLAN_MEAL_SLOTS } from '@/lib/itinerary-types'

/**
 * Every editable field of one V3 activity — the SHARED form behind both the
 * admin trip builder and the traveller's own trip editor.
 *
 * Extracted from TripBuilderV3's ActivityCard so the two surfaces can't drift
 * apart against one schema ([columns.md](docs/pre-planned-trip/columns.md)).
 * This is a CODE-sharing concern only: the two documents stay independent — an
 * admin template and a user's copy of it are separate rows that never sync.
 *
 * `mode` gates the fields a traveller must not own:
 *   - `is_default` — the ADMIN's ⭐ recommendation on a meal choice. A traveller
 *     expresses their pick with `selected`, which is a different field.
 *   - `rating` — a fact about the place (Google's), not a preference.
 *   - the Maps pull (`mapsSlot`) — admin-only: it spends the capped Maps budget
 *     and owns `placeId` / `maps_api_call`.
 */
export type ActivityFieldsMode = 'admin' | 'traveller'

/**
 * Slot options as OFFERED in the picker. "Activity" is a single entry here —
 * the 1–8 suffix is assigned automatically (see `nextActivitySlot`).
 *
 * The stored value is still "Activity 3" per columns.md; only the choosing is
 * simplified. Nothing reads the digit — the schema treats Activity 1–8 as one
 * slot type, and the attractions count matches on the prefix — so making a human
 * pick the number was busywork with a real failure mode (two rows silently
 * sharing "Activity 1").
 */
export const ACTIVITY_SLOT_PREFIX = 'Activity'
export const MAX_ACTIVITY_SLOT = 8
export const ACTIVITY_SLOTS = [
  'Logistics', 'Living', 'Admin & Services',
  ...PLAN_MEAL_SLOTS,
  ACTIVITY_SLOT_PREFIX,
]

export const isActivitySlot = (slot: string) => slot.startsWith(ACTIVITY_SLOT_PREFIX)

/**
 * Lowest unused "Activity N" in this day, ignoring the row being changed.
 *
 * Fills GAPS rather than counting rows: delete Activity 2 and the next one added
 * takes the 2 back. Existing rows are never renumbered — a row's slot changing
 * under you because a neighbour was deleted would be worse than a gap.
 * Past 8 (the schema's ceiling) it stops at "Activity 8"; duplicates are legal,
 * and the alternative — refusing to add — would be a worse answer.
 */
export function nextActivitySlot(siblings: ActivityV3[], selfIndex?: number): string {
  const taken = new Set(
    siblings
      .filter((_, i) => i !== selfIndex)
      .map((a) => a.slot)
      .filter(isActivitySlot),
  )
  for (let n = 1; n <= MAX_ACTIVITY_SLOT; n++) {
    if (!taken.has(`${ACTIVITY_SLOT_PREFIX} ${n}`)) return `${ACTIVITY_SLOT_PREFIX} ${n}`
  }
  return `${ACTIVITY_SLOT_PREFIX} ${MAX_ACTIVITY_SLOT}`
}
const PRIORITIES: PlanPriority[] = ['Must', 'Recommend', 'Normal']
const QUEUE_TIMES = ['Low', 'Mid', 'High', 'Reserve']
const BOOKING_POLICIES = ['Walk-in Only', 'Same-Day Ticket', 'Optional', 'Recommended', 'Mandatory']
const CATEGORY_TAGS = ['', 'food', 'cafe', 'shopping', 'nature', 'temple', 'landmark', 'experience', 'nightlife', 'transport', 'stay']
const MEALS = new Set<string>(PLAN_MEAL_SLOTS)

/** The traveller editor's field shell. The admin builder passes its own to stay
 *  pixel-identical to the rest of that (older) form. */
export const FIELD_CLASS =
  'w-full rounded-xl border border-zen-black/15 bg-white px-3 py-2 text-sm text-zen-black transition-colors placeholder:text-graphite/40 focus:border-basel-brick focus:outline-none'

export default function ActivityFields({
  a,
  mode = 'admin',
  onPatch,
  fieldClass = FIELD_CLASS,
  mapsSlot,
  siblings,
  selfIndex,
}: {
  a: ActivityV3
  mode?: ActivityFieldsMode
  /** The day's other rows — how "Activity" resolves to a free number. Without
   *  them the picker falls back to "Activity 1". */
  siblings?: ActivityV3[]
  selfIndex?: number
  /** Merge a partial into this activity. The caller owns where it lives. */
  onPatch: (patch: Partial<ActivityV3>) => void
  /** Field shell override — the admin builder keeps its own `inp`. */
  fieldClass?: string
  /** Admin-only Maps pull panel, injected so this component never calls an
   *  admin API itself. */
  mapsSlot?: React.ReactNode
}) {
  const [more, setMore] = useState(false)
  const admin = mode === 'admin'

  const name = a.name ?? { en: '', th: '' }
  const desc = a.description ?? { en: '', th: '' }
  const notes = a.notes ?? { en: '', th: '' }
  const remark = a.remark ?? { en: '', th: '' }
  const links = a.links ?? {}
  const setName = (b: Bilingual) => onPatch({ name: b })
  const setDesc = (b: Bilingual) => onPatch({ description: b })
  const setLink = (k: keyof NonNullable<ActivityV3['links']>, v: string) =>
    onPatch({ links: { ...a.links, [k]: v || null } })

  return (
    <div className="space-y-2">
      {/* Slot · time · duration · priority — the row's structural facts */}
      <div className="flex flex-wrap items-center gap-2">
        {/* An Activity row shows as plain "Activity" here; the assigned number
            rides on the row's own chip. Re-picking "Activity" on a row that is
            already one is a no-op — it must not renumber itself. */}
        <select
          value={isActivitySlot(a.slot) ? ACTIVITY_SLOT_PREFIX : a.slot}
          onChange={(e) => {
            const picked = e.target.value
            if (picked !== ACTIVITY_SLOT_PREFIX) return onPatch({ slot: picked })
            if (isActivitySlot(a.slot)) return
            onPatch({ slot: nextActivitySlot(siblings ?? [], selfIndex) })
          }}
          className={`${fieldClass} w-auto! py-1`}
        >
          {ACTIVITY_SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input value={a.time ?? ''} onChange={(e) => onPatch({ time: e.target.value || null })} placeholder="--:--" className={`${fieldClass} w-[72px]! py-1`} />
        <input
          value={a.duration_min ?? ''}
          type="number"
          onChange={(e) => onPatch({ duration_min: e.target.value ? parseInt(e.target.value, 10) || null : null })}
          placeholder="นาที"
          className={`${fieldClass} w-[72px]! py-1`}
        />
        <select
          value={a.priority ?? ''}
          onChange={(e) => onPatch({ priority: (e.target.value || null) as ActivityV3['priority'] })}
          className={`${fieldClass} w-auto! py-1`}
        >
          <option value="">— priority —</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        {/* ADMIN ONLY: ⭐ is the admin's recommendation on a meal choice. */}
        {admin && MEALS.has(a.slot) && (
          <label className="flex items-center gap-1 text-[11px] text-graphite/70">
            <input type="checkbox" checked={!!a.is_default} onChange={(e) => onPatch({ is_default: e.target.checked })} className="accent-amber-400" /> ⭐ แนะนำ
          </label>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input value={name.en} onChange={(e) => setName({ ...name, en: e.target.value })} placeholder="ชื่อ (EN)" className={`${fieldClass} py-1.5`} />
        <input value={name.th} onChange={(e) => setName({ ...name, th: e.target.value })} placeholder="ชื่อ (TH)" className={`${fieldClass} py-1.5`} />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <textarea value={desc.en} onChange={(e) => setDesc({ ...desc, en: e.target.value })} rows={2} placeholder="คำอธิบาย (EN)" className={`${fieldClass} resize-y py-1.5`} />
        <textarea value={desc.th} onChange={(e) => setDesc({ ...desc, th: e.target.value })} rows={2} placeholder="คำอธิบาย (TH)" className={`${fieldClass} resize-y py-1.5`} />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input value={a.cost ?? ''} onChange={(e) => onPatch({ cost: e.target.value || null })} placeholder="ราคา · Cost" className={`${fieldClass} py-1.5`} />
        <input value={a.location ?? ''} onChange={(e) => onPatch({ location: e.target.value || null })} placeholder="พื้นที่ · Location (City, District)" className={`${fieldClass} py-1.5`} />
      </div>

      <button
        type="button"
        onClick={() => setMore(!more)}
        className="flex items-center gap-1 text-[11px] font-bold text-basel-brick hover:underline"
      >
        <ChevronDown size={12} className={`transition-transform ${more ? 'rotate-180' : ''}`} />
        {more ? 'ซ่อนข้อมูลเพิ่มเติม' : 'ข้อมูลเพิ่มเติม · More (คิว/ลิงก์/โน้ต)'}
      </button>

      {more && (
        <div className="space-y-2 border-t border-zen-black/10 pt-2">
          {mapsSlot}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {/* ADMIN ONLY: the place's own rating, pulled from Google. */}
            {admin && (
              <input
                type="number"
                step="0.1"
                value={a.rating ?? ''}
                onChange={(e) => onPatch({ rating: e.target.value ? parseFloat(e.target.value) : null })}
                placeholder="★ rating"
                className={`${fieldClass} py-1.5`}
              />
            )}
            <select value={a.queue_time ?? ''} onChange={(e) => onPatch({ queue_time: (e.target.value || null) as ActivityV3['queue_time'] })} className={`${fieldClass} py-1.5`}>
              <option value="">— queue —</option>{QUEUE_TIMES.map((q) => <option key={q} value={q}>{q}</option>)}
            </select>
            <select value={a.booking_policy ?? ''} onChange={(e) => onPatch({ booking_policy: (e.target.value || null) as ActivityV3['booking_policy'] })} className={`${fieldClass} py-1.5`}>
              <option value="">— booking —</option>{BOOKING_POLICIES.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <select value={a.category ?? ''} onChange={(e) => onPatch({ category: e.target.value || null })} className={`${fieldClass} py-1.5`}>
              {CATEGORY_TAGS.map((c) => <option key={c} value={c}>{c || '— category —'}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input value={a.operating_hours ?? ''} onChange={(e) => onPatch({ operating_hours: e.target.value || null })} placeholder="เวลาเปิด · Hours" className={`${fieldClass} py-1.5`} />
            <input value={a.how_to_book ?? ''} onChange={(e) => onPatch({ how_to_book: e.target.value || null })} placeholder="วิธีจอง · How to book" className={`${fieldClass} py-1.5`} />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input value={notes.en} onChange={(e) => onPatch({ notes: { ...notes, en: e.target.value } })} placeholder="โน้ต (EN)" className={`${fieldClass} py-1.5`} />
            <input value={notes.th} onChange={(e) => onPatch({ notes: { ...notes, th: e.target.value } })} placeholder="โน้ต (TH)" className={`${fieldClass} py-1.5`} />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input value={remark.en} onChange={(e) => onPatch({ remark: { ...remark, en: e.target.value } })} placeholder="ข้อควรรู้ (EN)" className={`${fieldClass} py-1.5`} />
            <input value={remark.th} onChange={(e) => onPatch({ remark: { ...remark, th: e.target.value } })} placeholder="ข้อควรรู้ (TH)" className={`${fieldClass} py-1.5`} />
          </div>
          {/* Links. Schemes are scrubbed server-side on write (scrubItineraryUrls)
              and again by safeHref at every render sink. */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input value={links.map ?? ''} onChange={(e) => setLink('map', e.target.value)} placeholder="Map URL" className={`${fieldClass} py-1.5`} />
            <input value={links.walking_route ?? ''} onChange={(e) => setLink('walking_route', e.target.value)} placeholder="Walking route URL" className={`${fieldClass} py-1.5`} />
            <input value={links.website ?? ''} onChange={(e) => setLink('website', e.target.value)} placeholder="Website" className={`${fieldClass} py-1.5`} />
            <input value={links.ig ?? ''} onChange={(e) => setLink('ig', e.target.value)} placeholder="Instagram" className={`${fieldClass} py-1.5`} />
            <input value={links.fb ?? ''} onChange={(e) => setLink('fb', e.target.value)} placeholder="Facebook" className={`${fieldClass} py-1.5`} />
            <input value={links.tt ?? ''} onChange={(e) => setLink('tt', e.target.value)} placeholder="TikTok" className={`${fieldClass} py-1.5`} />
          </div>
        </div>
      )}
    </div>
  )
}
