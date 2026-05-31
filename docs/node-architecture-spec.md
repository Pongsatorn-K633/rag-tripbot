# Node + Category Architecture — Design Spec (Draft)

Status: **design only** — no code/migration yet. Captures the locked decisions and
the proposed shapes so we can build incrementally.

## Goal

Move pre-planned trips from a flat itinerary blob toward a **node + category** model:
- Admins **mix-and-match** reusable place/activity *nodes* into days.
- Each node is tagged to a **category** (taxonomy) for icons, filters, and reasoning.
- Days use **canonical slots** (esp. meals) so the LLM can answer deterministically
  (e.g. *"มื้อเช้าไม่ได้อยู่ในแผนครับ"*).
- Nodes carry **place metadata** (Google Maps link now; `placeId`/coords later).

## Naming convention

The atomic unit is a **node** — a place / activity / meal / stay / logistics item from
the Node Library, snapshotted into a trip. There is **no separate "activity" entity** —
an activity is just a node. A node's **role is named by its category root**:

| Category root | Node name | Renders as |
|---|---|---|
| Logistics | **logistics node** | a compact transport step in the timeline |
| Living | **living node** (stay) | accommodation |
| Food & Beverage | **food node** | a meal slot or a timeline item |
| Experiences | **experience node** | an activity card |
| Goods & Retail | **shopping node** | an activity card |
| Admin & Services | **service node** | an activity card |
| Emergency | **emergency node** | an activity card |

A day holds nodes in two places:
- **Slots** — fixed positions: the three `meals` + `accommodation`. A slot is empty,
  one node, or a pick-one-of-N **choice**.
- **Timeline** — an ordered list of nodes (each with a `time`). A **logistics node**
  renders as a transport step *between* the nodes around it; every other node renders
  as an activity card.

Code note: the TS types still use `Activity` / `ActivityV2` for a timeline entry — that
name is **legacy**; conceptually an entry is a *node entry* = `{ time, priority?, node }`,
and `categoryCode.startsWith('log.')` ⇒ it's a logistics node (`Activity.isLogistics`).

## Locked decisions (from review)

| # | Decision | Choice |
|---|---|---|
| 1 | Node ↔ trip relationship | **Snapshot** — library is a starting point; adding a node *copies* it into the trip. Editing a library node does **not** change existing trips. |
| 2 | Storage | **Hybrid** — `Category` + `Node` are relational tables; a **trip stays one self-contained `jsonb` document** in the new node/slot shape. |
| 3 | Taxonomy scope | **Destination-agnostic, Japan-first** — rows tagged `generic` \| `JP`; add `TH/KR/…` later without touching shared rows. |
| 4 | This round | **Spec + taxonomy draft only.** (See `docs/template-structure/dopamichi-categories.{json,xlsx}`.) |
| 5 | Day rigidity | **Meals fixed** (`breakfast/lunch/dinner` always-present keys, value optional) **+ activities as a flexible ordered timeline.** |
| 6 | Category field | **Replace** the old flat `category` enum **fully** with `categoryCode` (→ `Category.code`). No coarse-enum fallback. |

## Why hybrid + snapshot (the load-bearing choices)

A trip is already a self-contained `jsonb` cell, and **everything depends on that**:
duplication, the LIFF view, the LLM injection, the share-code bridge, and trip-lock
all treat a trip as one frozen document. Keeping that intact means we add the node
*library* without rewriting those systems. Snapshotting means a **published** trip
never silently changes because an admin edited a place in the library — stability
and the lock semantics survive.

The **library** (relational `Node`) is what unlocks mix-and-match, reuse, search, and
future place-matching during *authoring*; the **trip** is the immutable result.

---

## Data model

### 1. `Category` (new relational table — reference data)

Seeded from `docs/template-structure/dopamichi-categories.json`. Rarely changes.

```prisma
model Category {
  id          String  @id @default(cuid())
  code        String  @unique   // "food.dine.ramen" — STABLE; nodes reference this
  root        String             // Logistics | Living | Food & Beverage | Experiences | Goods & Retail | Admin & Services | Emergency
  category    String             // mid group
  subCategory String             // leaf node type
  emoji       String
  filterGroup String?            // transport only: public_transport | on_demand | private_transport
  destination String  @default("generic") // generic | JP | TH | ...
  description String?
  sortOrder   Int     @default(0)
  nodes       Node[]
}
```

### 2. `Node` (new relational table — the place/activity library)

The reusable unit an admin picks from. Place-search fields are present but optional
(manual entry now; auto-fill later).

```prisma
model Node {
  id           String   @id @default(cuid())
  name         String              // English / romaji (primary)
  nameTh       String?             // ไทย
  categoryCode String              // → Category.code
  category     Category @relation(fields: [categoryCode], references: [code])
  notes        String?             // default blurb (bilingual)
  cost         String?             // "¥1,500", "Free", "¥3,000-5,000"
  duration     String?             // "1.5h"
  // ── place metadata ──
  mapUrl       String?             // Google Maps link (manual now)
  placeId      String?             // Google Place ID (future auto-match)
  lat          Float?
  lng          Float?
  city         String?             // "Sapporo", "Kyoto" — for grouping/search
  createdById  String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@index([categoryCode])
  @@index([city])
}
```

### 3. Trip itinerary — new `jsonb` shape (snapshot of chosen nodes)

The trip document stays in `Template.itinerary` / `Trip.itinerary`, restructured:

```jsonc
{
  "version": 2,
  "title": "Hokkaido Snow Adventure",
  "totalDays": 5,
  "season": "Winter",
  "days": [
    {
      "day": 1,
      "location": "Sapporo",
      "free": false,
      // ── canonical meal slots: keys ALWAYS present, value may be null ──
      "meals": {
        "breakfast": null,
        "lunch":  { "kind": "single", "node": <NodeSnap> },
        "dinner": { "kind": "choice", "label": "อาหารเย็นซัปโปโร",
                    "selected": null, "options": [ <NodeSnap>, <NodeSnap> ] }
      },
      // ── ordered, flexible activity timeline ──
      "activities": [
        { "time": "09:30", "priority": "mandatory", "node": <NodeSnap> }
      ],
      "accommodation": { "kind": "single", "node": <NodeSnap> } | null,
      "transport": [
        { "from": "New Chitose", "to": "Sapporo", "node": <NodeSnap>, "notes": "JR Rapid, 37 min" }
      ]
    }
  ],
  "shareCode": "SAP-199"
}
```

`<NodeSnap>` — a **frozen copy** of the library node at insert time (so trips never drift):

```jsonc
{
  "nodeId": "cuid-or-null",          // provenance back to the library (nullable for ad-hoc)
  "name": "Susukino Ramen Village",
  "nameTh": "ซูซูกิโนะ ราเมน วิลเลจ",
  "categoryCode": "food.dine.ramen",
  "emoji": "🍜",                      // denormalized for render without a join
  "notes": "ราเมนซัปโปโรต้นตำรับ",
  "cost": "¥1,000-1,500",
  "duration": "1h",
  "time": "18:00",
  "mapUrl": "https://maps.google.com/…",
  "placeId": null
}
```

**Slot kinds** generalize today's `choices`: a slot is `null` | `{kind:"single", node}`
| `{kind:"choice", label, selected, options[]}`. Meals, accommodation, and any
activity can all be a single or a choice.

---

## One canonical shape → both outputs

The trip `jsonb` **is** the source of truth. The "node format" (mix-and-match in the
admin UI) and the "LLM JSON" are the *same* document:
- **Admin UI** edits it slot-by-slot, picking `NodeSnap`s from the `Node` library.
- **LLM** is handed it (lightly stringified). Because `meals` always has
  `breakfast/lunch/dinner` keys, the model can say *"breakfast isn't scheduled"*
  instead of guessing. `buildDateContext` already resolves day→date; it'll read
  `meals`/`activities` slots instead of the flat `activities[]`.

---

## Place metadata & Google Maps

- **Now (fallback):** admin types `name` + pastes `mapUrl`; the user taps it to open Maps.
- **Later:** a place-search box auto-fills `placeId` + `lat/lng` + `mapUrl` from a
  provider (Google Places) or our own accumulated `Node` library (autocomplete by
  `name`/`city`). Schema already reserves those fields — no rework.

---

## Admin UI outline (later phase)

1. **Category browser** — read-only taxonomy (icons, filterGroups).
2. **Node library** — CRUD + search/autocomplete by name/city/category; paste Maps link.
3. **Trip builder** — per day: fill meal slots + activity timeline + accommodation +
   transport by picking nodes from the library (mix-and-match); reorder; mark choices;
   set availability (existing editor).
4. Reuses the existing availability + cover-image + share-code pieces unchanged.

---

## Migration plan (phased, each shippable)

| Phase | Scope | Breaking? |
|---|---|---|
| **N1** | `Category` table + seed from the JSON draft | No (additive) |
| **N2** | `Node` table + admin CRUD/search; no trip changes yet | No (additive) |
| **N3** | New trip `jsonb` shape + TS types (`version: 2`); a **reader that accepts v1 *and* v2**; convert consumers (`ItineraryView`, `ItineraryEditor`, `injector`, exporter) to the slot model | Internal; v1 trips still render via the compat reader |
| **N4** | **Trip builder UI** (mix-and-match nodes into slots) replacing the current template editor | No data break |
| **N5** | One-off migration: convert existing v1 templates → v2 (map flat `category` enum → `categoryCode`, `choices`→choice slots, infer meal slots from food activities) | Data migration, reversible-by-keeping-v1 |
| **N6** | Place search (`placeId`/coords) when a provider/库 is wired | Additive |

A **`version` field** on the itinerary lets v1 and v2 coexist during the transition —
no big-bang rewrite.

## Blast radius (consumers of the day shape)

`ItineraryView` · `ItineraryEditor` · `lib/line/injector` (formatItinerary +
buildDateContext) · `lib/availability` (only totalDays/availability — minimal) ·
`lib/share-code` bridge · duplicate flow (`PlanPreviewModal` + `extend`) ·
`scripts/export-templates` · admin dashboard · gallery upload. A compat reader in N3
keeps these working while they're migrated one at a time.

## Open questions for later

None blocking — revisit fine points during build.

## Resolved

- Day rigidity → **meals fixed + activities flexible timeline** (decision 5).
- Category field → **fully replace** the flat enum with `categoryCode` (decision 6).
- **Ad-hoc nodes → allowed** (decision 7): admin can type a place inline in the trip
  (`nodeId: null`); an optional **"save to library"** button promotes it to a reusable
  `Node` (then `nodeId` is set). Low friction + the library grows organically.
- **Node names → English + Thai** (decision 8): `name` (EN/romaji) + `nameTh` (ไทย).
  No Japanese field for now.
- **Transport modeled as nodes** (decision 9): JR / Shinkansen / Metro etc. are
  **Logistics-category nodes**. A transport leg is
  `{ "from": "…", "to": "…", "node": <NodeSnap categoryCode "log.rail.*">, "notes": "…" }`.
