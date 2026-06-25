# Phase 2 — V3 Admin Editor (the Trip Builder, rebuilt for the rich schema)

> **Decision (carried):** edit pre-planned trips from the admin UI instead of hand-editing
> JSON. Requires the builder to read/write the full **V3** schema (`docs/pre-planned-trip/columns.md`).
> This is a sizeable, multi-pass build. Start here next session.

## Why it's needed
- The JSON → re-import loop works but is slow for content edits.
- The current Trip Builder + edit route are **V2-only**. Opening a V3 trip there runs
  `migrateV1toV2()` on a V3 itinerary → mangles/crashes it. **Known latent bug:** the admin
  dashboard "Edit" on a V3 template is unsafe today — guard or hide it until this lands.

## Current state to build on
- **Render side is done (Phase 4):** `getRenderDays` handles V3; `ItineraryView` shows the
  rich card (location/rating/hours/queue×booking/links/remark), highlights carousel, guides,
  meal choices with ⭐ recommended. So we already have the *display* of every V3 field.
- **Importer is the reference shape:** `lib/trips/import-plan.ts` → `ItineraryV3`. The editor
  must produce the same `ItineraryV3` object the importer does.
- **Dev workflow:** `.env.local` → Neon `dev` branch; `npx tsx scripts/import-dopamichi.ts --publish`
  (idempotent by `sourceFile`). Draft/publish via `Template.published`.

## Scope — fields the editor must cover (from columns.md)
**Trip meta (`overview`):** title · cover_tagline · description · area_code · cover_images
(image picker — the one thing JSON can't do well) · available_period · **recommended_period[]**
(1+ windows) · available_airports · car_rental (Y/N + group-size presets) · arrival buffers ·
the 5 bilingual **guides** · **highlights[]** (name/description/level 😍⭐👌).

**Per day:** `name {en,th}` (day theme).

**Per activity (`ActivityV3`):** slot · is_default · time · duration_min · priority
(Must/Recommend/Normal) · location · name {en,th} · description {en,th} · cost · rating ·
category (pick-in-app) · operating_hours · queue_time · booking_policy · how_to_book ·
notes {en,th} · remark {en,th} · links {map, walking_route, ig, fb, tt, website}.
(`maps_api_call` deferred — Google Maps integration is a later phase.)

**Choice rule:** only the 6 meal slots are choosable (adjacent same-slot rows); ⭐ = `is_default`.

## MVP for the first session (don't boil the ocean)

**THE SAFE-SAVE RULE (critical):** the editor **loads the full `ItineraryV3`, edits a subset
of fields, and saves the whole object back** — so any field not exposed in the form (rating,
queue/booking, links, guides, highlights, …) is **preserved, never wiped**. Keep the full
activity objects in state; the form only mutates specific keys.

**MVP (one focused session):**
- Guard the dashboard "Edit" for V3 (no crash) + a V3 edit route that loads `ItineraryV3` (no migrate).
- `TripBuilderV3`:
  - **Meta:** title · cover_tagline · description · cover-image picker (reuse) · recommended-periods list · airports (reuse).
  - **Per day:** name `{en,th}`.
  - **Per activity:** slot · time · duration_min · priority · name `{en,th}` · description `{en,th}` · cost · location, + meal **choices** (adjacent grouping).
- Save → store V3 as-is (preserving untouched fields), derive availability, set `Template.description = cover_tagline`.

**Deferred to a later pass (still JSON-editable; already render):** rating · operating_hours ·
queue_time · booking_policy · how_to_book · links · notes/remark · guides editor · highlights
editor · car_rental · arrival buffers · area_code · category.

## Open decisions (resolve at kickoff)
1. **Fresh V3 builder component vs. extend `TripBuilder.tsx`?** Lean: a new `TripBuilderV3`
   (the V2 one stays for any legacy v2 templates) to avoid a tangled dual-mode component.
2. **Bilingual input:** EN-first with Claude/LLM auto-generating TH per `thai-style.md`, or
   two manual fields? (columns.md says EN-only authoring is allowed.)
3. **How rich to ship first?** Suggest an MVP slice: meta (title/tagline/description/cover/
   periods/airports) + day name + per-activity core (slot/time/duration/priority/name/desc/
   cost/location) + meal choices. Defer queue/booking/links/guides/highlights editors to a
   second pass (they already *render*).
4. **Save path:** `POST/PATCH /api/admin/templates` storing the V3 itinerary as-is (no
   migrate); set `Template.description = cover_tagline`, derive `availability`.

## Suggested first steps next session
1. Guard the dashboard "Edit" for V3 templates (don't crash) — quick safety fix.
2. Scaffold `TripBuilderV3` + a V3 edit route that loads `ItineraryV3` (no migrate).
3. Build the **meta** section first (incl. cover-image picker + recommended-periods list editor).
4. Then the **day/activity** editor (reuse `NodePicker`/slot patterns where possible).
5. Wire save → verify round-trip: builder → save → `getRenderDays` → matches the JSON import.
