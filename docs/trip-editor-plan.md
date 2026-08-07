# Full Trip Editor — Plan

> **Status:** COMPLETE — Stages 0–3 shipped 2026-08-08.
> Goal: a traveller can reorder days and edit every activity of their own trip —
> time, links, description, restaurant choices — not just pick a meal and delete rows.
> Related: [duplicate-edit-feature.md](duplicate-edit-feature.md) (Phase 7),
> schema SSOT [pre-planned-trip/columns.md](pre-planned-trip/columns.md).

---

## 1. What already exists (do NOT rebuild)

| Piece | Where | State |
|---|---|---|
| Edit page + route | [app/trips/[id]/edit/page.tsx](../app/trips/%5Bid%5D/edit/page.tsx) | exists; ✏️ on every /my-trips card links here |
| Traveller editor | [app/components/ItineraryEditorV3.tsx](../app/components/ItineraryEditorV3.tsx) (139 lines) | start date · pick one meal option · ↑/↓ reorder rows **within** a day · delete row. Pre-2026-07 design language. No field editing, no day reorder, no add |
| **Every-field activity form** | [app/admin/trip-builder/TripBuilderV3.tsx](../app/admin/trip-builder/TripBuilderV3.tsx) (670 lines) | admin builder — already edits time, duration, slot, priority, bilingual name/description/notes, cost, links, 📍 Maps lookup |
| Write path | `PATCH /api/trips/[id]` → `updateTripItinerary` ([lib/trips/edit.ts](../lib/trips/edit.ts)) | accepts a full itinerary; ownership checked; validation is SHALLOW (see §5) |
| Summary-pill editing | [PlanPreviewModal](../app/components/PlanPreviewModal.tsx) | dates, flights, car-rental days — shipped 2026-08-08 |

**The central move:** extract the admin builder's activity-row form into a shared
component with an `admin | traveller` mode, and render it from BOTH pages —
otherwise two copies of the same form drift apart. This is a CODE concern only;
the two documents stay fully independent (§6).

## 2. Settled decisions (2026-08-08)

1. **Where** — expand `/trips/[id]/edit`. The read-only modal stays read-only:
   one place to read, one place to write. (Rejected: inline edit mode in the
   modal — it is already ~1000 lines and dense forms in a fullscreen overlay are
   poor on mobile.)
2. **Day reorder** — the day moves **with all its rows untouched**. No conflict
   flags, no warnings: a plan whose transport no longer connects is the
   traveller's call to make (owner decision, 2026-08-08). (Rejected: moving only
   attractions — dragging a day that visibly leaves half its content behind is
   surprising.)
3. **Editable fields** — everything EXCEPT:
   - `is_default` — the admin's ⭐ recommendation; the traveller's pick is `selected`
   - `placeId` / `maps_api_call` — system-owned, and the Maps budget is capped at
     1,000/month (`mapsBudget`)
   - `rating` — a fact about the place, not a preference
4. **Saving** — explicit **Save** button (one PATCH of the whole itinerary) plus
   an unsaved-changes guard. Matches how PATCH already works (last write replaces
   the itinerary) and keeps a failed save visible. (Rejected: autosave — every
   change would rewrite an ~86 KB jsonb blob with no undo.)

## 3. Staged plan

**Stage 0 — harden the write path. DONE 2026-08-08.** `scrubItineraryUrls` in
[lib/trips/edit.ts](../lib/trips/edit.ts) walks the saved itinerary and nulls any
href-bearing value whose scheme isn't http(s) — V3 `links.*` and the v1/v2
`mapUrl`/`walkingUrl` pair. See §5 for why this is a scrub and not
`importPlanJson`.

**Stage 1 — shared activity form. DONE 2026-08-08.**
[app/components/ActivityFields.tsx](../app/components/ActivityFields.tsx) — every
editable V3 field, `mode: 'admin' | 'traveller'`. The admin builder renders it
with `fieldClass={inp}` (pixel-identical to the rest of that form) and injects
its Maps panel via `mapsSlot`, so the shared component never calls an admin API.
The slot / priority / queue / booking / category vocabularies moved here and were
deleted from the builder — one place to edit them now. Builder: 670 → 618 lines.
**Regression check owed: author a trip on the prod dashboard.**

**Stage 2 — traveller editor. DONE 2026-08-08.**
[ItineraryEditorV3](../app/components/ItineraryEditorV3.tsx) rebuilt (139 → ~330
lines): trip name + start date · day rename/add/remove (renumbering on remove) ·
activity add/remove/↑↓ · accordion → `ActivityFields` in traveller mode · meal
rows show "เลือกร้านนี้" (sets `selected`, clears same-slot siblings) and
"เพิ่มตัวเลือก" (inserts a same-slot neighbour = a new choice option) · explicit
Save with a `beforeunload` guard. Title now goes through `PATCH` too.
Page kept on the CREAM canvas (not graphite): `isGraphiteRoute` matches exactly,
and `/trips/[id]/edit` would need prefix matching — deferred, not decided.

**Stage 3 — day reorder. DONE 2026-08-08.** `Reorder.Group`/`Reorder.Item` from
`motion/react`. `dragListener={!isOpen}`: a collapsed day drags anywhere on the
card, an open one never drags (so a gesture can't start on a field you meant to
select). ↑/↓ buttons work in both states and cover keyboard/assistive use.

**Day numbers are normalized only in `payload()` at save**, not during the drag:
renumbering live would change each card's React key mid-gesture, remounting it
and killing the animation. The badge shows the INDEX while editing, so position
still reads correctly; `day` returns to 1..n on save, which is the only time the
renderer or the date derivation reads it.

## 4. Data notes

- **Choices are adjacent same-slot rows**, not a nested structure — "add a
  restaurant option" = insert another row with the same slot next to it. Only the
  6 meal slots are choosable (settled decision, V3-HANDOFF §6).
- **Attractions count** = rows whose `slot` starts with `Activity` — editing
  slots changes the number on the summary card.
- **Free days** added by `extendItineraryWithFreeDays` are ordinary days; the
  reorder treats them like any other.
- Growing/shrinking a trip's LENGTH is a separate operation from re-dating it —
  the summary-pill date editor deliberately does not do it (noted 2026-08-08).

## 5. Security precondition — DONE

Letting travellers author `links` re-opens the stored-XSS surface the security
review closed with `safeHref` at the render sink, because `PATCH /api/trips/[id]`
ran only a shallow shape check (open item **#3/#7** in
[V3-HANDOFF §8](V3-HANDOFF.md)).

Closed on 2026-08-08 with **`scrubItineraryUrls`**, NOT with `importPlanJson`:
normalizing would impose the admin authoring schema on a document that is the
user's own (§6), silently reshaping or dropping whatever they had. The scrub
touches only href-bearing keys and leaves every other byte alone. Render-side
`safeHref` stays as defence in depth.

Note this narrows the item for **trips** only. `POST /api/admin/templates` still
stores its itinerary unnormalized — same shallow-validation gap, admin-gated.

## 6. A user trip is its own document

Duplicating copies the itinerary INTO `Trip.itinerary` (its own jsonb).
`templateId` is a back-reference only, and `import-dopamichi.ts` updates the
`Template` row matched by `sourceFile` — it never touches linked user trips. So a
traveller's edits can diverge arbitrarily from the pre-planned trip they came
from, and re-authoring that trip on the admin dashboard will not reach back into
anyone's copy. The editor must never "fix" a user trip toward the template.

The shared activity form (§3, Stage 1) is about not maintaining two copies of the
same form CODE. It implies no coupling of the data.
