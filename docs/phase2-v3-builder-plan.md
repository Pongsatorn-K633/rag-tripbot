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

## Implementation breakdown (files to touch)

| Step | File | Change |
|---|---|---|
| Guard | `app/admin/dashboard/AdminDashboard.tsx` | Where templates list + link to edit: if `itinerary.version === 3`, point "Edit" at the V3 editor route (or disable with a tooltip) instead of the V2 builder. |
| Route | `app/admin/trip-builder/[id]/page.tsx` | Branch on version: `isV3(tpl.itinerary)` → render `<TripBuilderV3 initial={...}/>` with the itinerary **un-migrated**; else keep the current V2 path (`migrateV1toV2`). |
| Editor | `app/admin/trip-builder/TripBuilderV3.tsx` *(new)* | The editor. Holds the **full `ItineraryV3`** in state; form mutates a subset (see safe-save rule). |
| Save API | `app/api/admin/templates/[id]/route.ts` (PATCH) + `route.ts` (POST) | Accept a `version:3` itinerary; store **as-is** (no migrate). Set `Template.description = overview.cover_tagline ?? firstLine(description)`, `totalDays = days.length`, and `availability = deriveAvailability(itin)`. `coverImages ← overview.cover_images`. |

## Component architecture — `TripBuilderV3`

```
TripBuilderV3({ initial: { id, itinerary: ItineraryV3, shareCode, published } })
  state: const [itin, setItin] = useState<ItineraryV3>(initial.itinerary)   // FULL object
         const [coverImages, setCoverImages] = useState(itin.overview.cover_images ?? [])
  helpers: setOverview(patch) · setDay(i, patch) · setActivity(di, ai, patch)   // immutable nested updates
  sections:
    <MetaSection>      title · cover_tagline · description (textarea) · CoverPicker · airports chips · PeriodsEditor
    <DaysSection>      per day: name.en / name.th + <ActivityList>
       <ActivityRow>   slot <select> · time · duration_min · priority <select> · is_default (meal only)
                       name.en/.th · description.en/.th · cost · location · [remove]
  save(): POST/PATCH { title: itin.overview.title, itinerary: itin, coverImage: coverImages[0] ?? null, coverImages }
```

**Bilingual fields** = two inputs (`EN` / `TH`) side by side for `name`, `description` (day name too).
MVP keeps it manual; a "✨ generate TH from EN" button (LLM, per `thai-style.md`) is a nice later add.

## Reuse from the V2 builder (don't rebuild)
- **`CoverPicker`** (`app/components/CoverPicker.tsx`) — image picker, `value: string[]`. Use as-is for `cover_images`.
- **Airports chips** — lift the toggle-chip block + `AIRPORTS` from `TripBuilder.tsx` verbatim.
- **`NodePicker`** — optional: only if you want library-node prefill; V3 activities are free-form text, so not required for MVP.
- **Section / input styling** — copy the `inp` class + `Section` wrapper from `TripBuilder.tsx` for visual consistency.

## Periods editor (NOT RangeEditor)
`recommended_period` is an array of `{ primary, details }` **strings** ("1 Oct – 15 Nov" + blurb),
NOT `DateRange` MM-DD. So build a small repeatable list of (primary, details) text inputs with
add/remove. `RangeEditor` is for the MM-DD `availability` — which here is **derived on save** by
`deriveAvailability()` from the period strings, so the editor does NOT edit availability directly.

## Verification checklist (definition of done for the MVP)
1. Open the imported `TKY-001` (V3) via the dashboard "Edit" → loads in `TripBuilderV3` (no crash).
2. **Safe-save test:** change only the title → save → re-open → a rich field that the form does
   NOT expose (e.g. an activity's `rating`, `queue_time`, or a `links.map`) is **still present**.
3. Edit cover_tagline + a recommended period + an activity's name/cost → save → `/pre-planned`
   reflects it (cover hook, date filter, card) after refresh.
4. `getRenderDays` on the saved itinerary === the render of the JSON import (no shape drift).
5. `tsc` + `next lint` clean.

## Gotchas / risks
- **Losing rich data on save** — the #1 risk; the safe-save rule (full object in state) prevents it.
- **`Template.description` vs `cover_tagline`** — the cover reads `Template.description`; keep
  setting it to `cover_tagline` on save (we already do this in `import-dopamichi.ts`).
- **availability is derived, not edited** — don't add a DateRange editor; edit the period strings.
- **Choice grouping** — meals become a choice only when 2+ adjacent rows share a meal slot; the
  ⭐ is `is_default`. The editor just needs slot + is_default per row; `getRenderDays` handles grouping.
- **Don't touch the V2 builder's behavior** — legacy v2 templates must still edit through the old path.

---

# Beyond the MVP — the rest of the roadmap (everything we discussed)

The MVP above is just the first slice. Here's the full backlog so we don't lose context.

## Phase 2b — complete the V3 editor (the deferred rich-field editors)
All of these already **render** (Phase 4); 2b makes them **editable** in `TripBuilderV3`:
- **Queue × booking** — `queue_time` + `booking_policy` dropdowns; show the resulting 15-case
  matrix message live (reuse `queueBookingBadge`). `how_to_book` text.
- **rating · operating_hours** — usually Maps-API-sourced; manual inputs for now.
- **Links editor** — `map · walking_route · ig · fb · tt · website` (URL inputs).
- **notes `{en,th}` · remark `{en,th}`** — bilingual.
- **Guides editor** — the 5 bilingual guides (logistic/food/accommodation/queue/remark).
- **Highlights editor** — name/description/level (😍⭐👌) + **photo** (replaces the mock; ties to the image picker).
- **car_rental** (Y/N + group-size preset rows) · **arrival buffers** · **area_code**.
- **category** — a dropdown from the **`Category`** DB table (`food.dine.ramen` …); the icon/emoji
  derives from the chosen category (see settled emoji decision below). NB: render `Activity.category`
  is the coarse `ActivityCategory` enum, while V3 `category` is the fine code — a mapping is needed.

## Phase 2c — bilingual UX
- **"✨ generate TH from EN"** button on bilingual fields (LLM, following `thai-style.md`:
  romanize proper names, keep loanwords Thai, cut filler). columns.md allows EN-only authoring.
- **EN/TH toggle** on the render side (`ItineraryView`) — the one deferred Phase 4 display item.

## Phase 3 — Excel ↔ JSON alignment (the transformer format)
- Regenerate the downloadable **Excel template** to the 31-column **A–AE** layout from `columns.md`.
- Update the deterministic parser `lib/trips/excel-template.ts` to the **V3** schema.
- **Generate the Excel FROM the SSOT** so it never drifts — see `docs/single-source-of-truth-plan.md`.

## Later — Google Maps integration (`maps_api_call`)
- For the `(Maps API)` columns: when `maps_api_call` is true, pull `displayName`, `rating`,
  `regularOpeningHours`, `googleMapsUri`, `priceLevel`, `websiteUri`, `formattedAddress`, etc.
- `placeId` resolution + a refresh action. Deferred deliberately ("focus later" — user's call).

## Phase 4 render — remaining polish
- EN/TH toggle (above) · category icons from the chosen code · **real highlight photos** (swap the
  gradient mock) · revisit the single-option meal carousel label.

## Optional dev quick-win — JSON watch mode
- `scripts/watch-plan.ts` + `npm run plan:watch`: auto re-import on JSON save → just refresh the
  browser. Removes the "tell me to reload" step until the UI editor is done. ~5 min to build.

## Settled decisions (don't re-litigate)
- **Emoji** = category-derived (DB `Category.emoji`) → **slot emoji fallback**; decorative emoji
  inside `notes` is just free text. Structured emoji is never hand-typed per row.
- **Choosable slots** = the **6 meals only**; `Activity 1–8` are never choices (columns.md updated).
- **`is_default`** = the admin's **⭐ recommended** option (a hint), distinct from the traveler's
  `selected` pick. Templates ship with `selected` unset.
- **`cover_tagline`** = the short cover hook; **`description`** = full text shown inside.
- **`recommended_period`** = an **array** (1+ windows); `availability` (MM-DD) is **derived** from it.
- **Slot name font** = uniform `text-sm` bold black across logistics / meals / activities.
- **SSOT** = `docs/pre-planned-trip/columns.md` (schema + Thai-style merged). Code follows it; edits
  update doc + code together. Reconciliation workflow: `docs/single-source-of-truth-plan.md`.

## Sequencing recommendation
MVP (2) → 2b → Phase 3 (Excel, so authors can use the spreadsheet again) → 2c (bilingual ✨ + EN/TH
toggle) → Maps (later). The JSON watch-mode is a cheap parallel win any time.
