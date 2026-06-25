# Single Source of Truth (SSOT) + Excel Alignment — Plan

> **Status:** PLAN ONLY — no code changes yet. We execute this **after** you upload the
> finalized Excel. This document is the agreement on *how* we reconcile Excel ↔ app and
> *where* each piece of vocabulary will permanently live.

---

## 1. The problem (confirmed)

The same "vocabulary" (meal slots, priorities, seasons, slot keywords, emojis, field
names) is **defined in several files**, and some of it gets edited directly in the
frontend. When one copy changes, the others silently drift. There is no one place an
admin-facing concept is defined and imported everywhere.

Some vocab *already* has a single home (good). Some is duplicated (the risk).

---

## 2. Current scatter inventory

Legend: ✅ already effectively SSOT · ⚠️ duplicated / drifts · ❌ missing.

| Concept | Where it lives today | State |
|---|---|---|
| **Meal slots** (breakfast/brunch/lunch/afternoon/dinner/latenight: emoji, TH, EN, keywords) | `lib/trips/itinerary-model.ts` `MEAL` map · `app/admin/trip-builder/TripBuilder.tsx` `MEALS` · `lib/trips/excel-template.ts` `MEAL_LABEL` + `slotKey` + `MealSlotKey` · `scripts/build-itinerary-template.ts` legend | ⚠️ defined **4×** |
| **Priorities** (mandatory/recommended/optional) | `lib/itinerary-types.ts` `ActivityPriority` + `PRIORITY_LABEL` (EN) · `TripBuilder.tsx` hardcoded `ต้อง/แนะนำ/เสริม` `<option>`s · `excel-template.ts` `priorityOf()` keyword parse · `build-itinerary-template.ts` legend "Must/Recommend/Optional" | ⚠️ type is SSOT, but **TH labels + keywords duplicated** |
| **Airports** (code → label, transfer buffers) | `lib/trips/itinerary-model.ts` `AIRPORTS` + buffer consts | ✅ one def, imported by `TripBuilder` + `PlanPreviewModal` |
| ↳ Airports in Excel | — | ❌ Excel parser does **not** read airports yet |
| **Seasons** (Winter/Spring/Summer/Autumn: emoji, month logic) | `TripBuilder.tsx` `SEASON_EMOJI` · `lib/availability.ts` `seasonsForRanges()` | ⚠️ emoji vs logic split |
| **Slot types** (meals + Timeline + Accommodation) | `excel-template.ts` `slotKey` · `TripBuilder.tsx` section structure · `build-itinerary-template.ts` `DAY_SLOTS` | ⚠️ duplicated |
| **Categories** (`food.dine.ramen` etc: code, root, emoji, filterGroup) | DB `Category` model ← `docs/template-structure/dopamichi-categories.json` ← `prisma/seed/seed-categories.ts` | ✅ JSON is SSOT, DB-seeded |
| ↳ v1 `ActivityCategory` + `CATEGORY_LABEL` | `lib/itinerary-types.ts` | ⚠️ **separate** legacy enum (v1 doc-to-trip) — possibly deprecate |
| **Nodes** (reusable activity units) | DB `Node` model (admin UI `app/admin/nodes`) → snapshotted into trip jsonb | ✅ DB is SSOT |
| **Trip meta fields** (Title, Area code, Available, Recommended, Cover images) | `excel-template.ts` Trip sheet · `TripBuilder.tsx` meta · `Template` model | ⚠️ field list duplicated |
| **Node columns** (name/nameTh/categoryCode/emoji/cost/duration/time/notes/mapUrl/placeId) | `NodeSnap` type · `Node` model · Excel columns (`ITINERARY_HEADERS`) · builder NodePicker | ⚠️ field list duplicated |
| **Choice-group convention** ("same day+slot+label = pick-one") | `excel-template.ts` parser · builder `SlotEditor` (2+ options) · render `ChoiceCarousel` | ⚠️ convention, not a shared const |
| **Itinerary JSON contract** | `CLAUDE.md` (v1 shape) vs actual v2 model in `lib/itinerary-types.ts` | ⚠️ doc is stale (v1) |

---

## 3. Target architecture — one vocab module

Create **`lib/trips/vocab.ts`** = pure data, no React / no DB imports. It becomes the
single home for every admin-facing, finite vocabulary. Everything else imports from it.

```
lib/trips/vocab.ts   ← SSOT for finite vocab (meals, priorities, seasons, slot types, airports)
        ▲   ▲   ▲   ▲
        │   │   │   └── scripts/build-itinerary-template.ts   (Excel GENERATED from vocab)
        │   │   └────── lib/trips/excel-template.ts           (Excel PARSED via vocab keywords)
        │   └────────── lib/trips/itinerary-model.ts          (render labels from vocab)
        └────────────── app/admin/trip-builder/*              (builder UI from vocab)
```

**Proposed exports** (final values decided during reconciliation):
- `MEAL_SLOTS`: ordered list `{ key, emoji, th, en, core: boolean, keywords[] }`
- `PRIORITIES`: `{ key, th, en, keywords[], default: boolean }`
- `SEASONS`: `{ key, emoji, th }`
- `SLOT_TYPES`: meal keys + `timeline` + `accommodation`, each with parse `keywords[]`
- `AIRPORTS` (moved here from itinerary-model) + transfer/check-in buffers
- `TRIP_META_FIELDS` / `NODE_COLUMNS`: the Excel column ↔ app field map

**Layering rules (the principles):**
1. **One definition per concept.** UI, parser, generator, renderer all *import* — none redefine.
2. **DB-backed taxonomies stay in the DB.** `Category` and `Node` remain DB models seeded
   from JSON; `vocab.ts` does *not* duplicate them. The Excel "Category" column must use
   codes from `dopamichi-categories.json`.
3. **Generated artifacts are built from the SSOT.** The downloadable
   `public/dopamichi-itinerary-template.xlsx` is *generated* by the script from `vocab.ts`,
   never hand-edited — so the Excel can't drift from the app.
4. **`CLAUDE.md` itinerary contract gets updated to the v2 shape** once locked.

---

## 4. The Excel ↔ app contract (what your Excel defines)

When you upload, your Excel tells us, authoritatively, **what an admin fills in to build a
trip**. We map each Excel element to an app concept:

| Excel element | Maps to app | Notes to settle |
|---|---|---|
| Sheet names | `TEMPLATE_SHEETS` | exact names + order |
| Trip-meta rows | `TRIP_META_FIELDS` / `Template` | which fields, required vs optional |
| Itinerary column headers | `NODE_COLUMNS` + `ITINERARY_HEADERS` | names, order, which are optional |
| **Slot** column values | `SLOT_TYPES` | the canonical slot words (incl. the 6 meals) |
| **Priority** column values | `PRIORITIES` | Must/Recommend/Optional ↔ ต้อง/แนะนำ/เสริม + default |
| **Category** column values | `Category.code` (JSON) | must reference real codes; validation list? |
| **Choice group** column | choice convention | exact rule for grouping pick-one options |
| **Default?** column | `Slot.selected` | template policy (we currently set *no* default) |
| Airports / flight | `AIRPORTS` / `TripFlight` | **decide:** admin-input or traveler-only? |
| Free-day marker | `Day.free` | the trigger value |

---

## 5. Reconciliation workflow (what I do when the Excel lands)

1. **Read** every sheet of your Excel (headers, slot values, priority values, sample rows,
   any new columns/fields).
2. **Build a diff table** per dimension:

   | Item | Excel says | App says today | Conflict? | My recommendation |
   |---|---|---|---|---|

3. **Present the diffs to you.** For every conflicting row you decide: **follow Excel** /
   **follow app** / **merge** (and I'll flag where one choice has downstream cost).
4. **Lock the values into `lib/trips/vocab.ts`** per your decisions.
5. **Refactor consumers** to import from `vocab.ts` (remove the duplicate defs in builder /
   excel parser / renderer / generator).
6. **Regenerate** `dopamichi-itinerary-template.xlsx` from the SSOT so the download matches.
7. **Verify:** `tsc`, `lint`, and an Excel→parse→render round-trip test.
8. **Update** `CLAUDE.md` (v2 contract) + this doc's decision log.

Nothing changes in the DB schema unless a decision requires it (e.g. a new `Template`
field) — those get called out explicitly before we touch Prisma/Neon.

---

## 6. Open questions to keep in mind while finishing the Excel

1. **Should the downloadable Excel be generated *from* the SSOT?** (Strongly recommended —
   kills future drift. Means the .xlsx layout is whatever `vocab.ts` produces.)
2. **Airports & flights in Excel?** Today: *airports* are admin-set (which airports serve
   the trip), *flight times* are traveler-input at duplicate. Does your Excel cover
   airports, or stay activities-only?
3. **Priority canonical labels** — keep both EN (`Must-do/Recommended/Optional`) and TH
   (`ต้อง/แนะนำ/เสริม`)? Which is the parse source for the Excel column?
4. **Category column** — do you want an in-Excel dropdown/validation listing the real
   codes from `dopamichi-categories.json`?
5. **Legacy v1 `ActivityCategory` / `CATEGORY_LABEL`** — still used by doc-to-trip v1; OK to
   deprecate once everything is v2?
6. **Default option policy** for choices — confirm templates ship with **no** pre-selected
   option (traveler picks).

---

## 7. Decision log (filled during reconciliation)

| Date | Concept | Decision (app / excel / merge) | Resulting value |
|---|---|---|---|
| _pending Excel upload_ | | | |
