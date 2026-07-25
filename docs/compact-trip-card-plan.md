# Compact horizontal trip card — build plan

> **Status:** planned 2026-07-26, not yet implemented. Trial placement is a second
> list **below** the existing cards on `/discover`, so the current card is untouched
> and the two can be compared side by side before anything is replaced.

## Goal

A horizontal, small variant of the boarding-pass card in
[`app/components/TripDeck.tsx`](../app/components/TripDeck.tsx) (`CardFace`).
**Exactly the same information**, square-cropped cover, shorter card.

## Decisions (locked with the owner)

| Question | Decision |
|---|---|
| Arrangement | **Stacked full-width rows** (a vertical list, one card per row) |
| Cover thumb | **Keep the multi-image carousel** — arrows + dots, scaled down |
| Barcode | **Vertical stub down the right edge** (boarding-pass stub in landscape) |
| PREVIEW → + chip cell | **Keep both**, scaled down — the full triptych with its rules |

## Information inventory — every element must survive

From `CardFace`, in order:

1. `{totalDays} DAYS` — headline, tracking `0.06em`
2. Heart save button — red when saved (deliberate palette exception), `stopPropagation`
3. Cover carousel — `coverImages` when authored, else the single `coverImage`
   via `resolveCoverImage`; arrows + dot indicators when >1
4. Rule → **PREVIEW ↓arrow** | **Chip glyph** | **TITLE** → rule
5. `description` — line-clamp-1
6. `แนะนำ` + `formatRanges(rec[0])` + `+N ช่วง` when more
7. `เปิดให้เที่ยว` + `formatRanges(avail[0])` + `+N ช่วง` when more
8. Deterministic barcode — `barcodeBars(tpl.id)`

## Layout

```
┌──────────────────────────────────────────────────┬───┐
│ ┌────────┐  8 DAYS                           ♡   │ ▮ │
│ │  IMG   │  ──────────────────────────────────   │ ▯ │
│ │  1:1   │  PREVIEW→ │▭│ TOKYO - NAGANO          │ ▮ │
│ │  ‹  ›  │  ──────────────────────────────────   │ ▯ │
│ │ ·•··   │  ตะลุยแสงสีโตเกียว พร้อมขับรถเที่ยว…        │ ▮ │
│ └────────┘  แนะนำ 1 ต.ค. – 15 พ.ย. +2 ช่วง          │ ▯ │
│             เปิดให้เที่ยว 17 เม.ย. – 15 พ.ย.          │ ▮ │
└──────────────────────────────────────────────────┴───┘
   132px        flex-1 (min-w-0)                    28px
```

- **Container:** `flex` row, `rounded-[20px] bg-briefing-cream overflow-hidden`,
  lighter shadow than the tall card (`0_10px_30px_rgba(0,0,0,0.28)`),
  `hover:-translate-y-1`. Width `w-full max-w-3xl` centred — a 1536px-wide row
  would stretch the text unreadably. Target height ≈ 150px.
- **Left:** `w-[132px] shrink-0`, square cover.
- **Middle:** `flex-1 **min-w-0**` — without `min-w-0` a flex child refuses to
  shrink and every `line-clamp`/`truncate` silently stops working.
- **Right:** `w-7` barcode column, `border-l border-dashed border-zen-black/25`
  as the perforation.

### Type scale (down from the tall card)

| Element | Tall | Compact |
|---|---|---|
| DAYS | 13px | 11px |
| Title | 20px, clamp-2 | 15px, clamp-1 |
| Description | 13px | 12px |
| Periods | 11px | 10px |
| Line-height | `leading-[23px]` | `leading-[18px]` |

**Keep an absolute `leading`, not a ratio.** The existing comment explains why:
mixed 13/11px sizes on a ratio get different half-leading and the gaps read
uneven, and a `line-clamp` box exactly one line-height tall shaves Thai's
stacked marks. 18px is the compact equivalent — verify with Thai text, not
English.

## Implementation steps

1. **`app/components/TripDeck.tsx`**
   - Parameterise `CoverCarousel`: optional `aspect` (default `'4/5'`, compact
     passes `'1/1'`) and `compact` (smaller arrows `h-6 w-6`, dots `h-1 w-1`).
     **Both must default to today's values** — this component is shared with the
     tall card, which must not shift by a pixel.
   - Add `export function TripCardCompact({ tpl, saved, isPending, onOpen, onHeart })`.
     A separate component, *not* a `variant` prop on `CardFace` — vertical and
     horizontal diverge enough that conditionals would tangle both.
   - Reuse the existing module-level `Chip`, `barcodeBars`, `formatRanges`,
     `resolveCoverImage` — no exports need to change.
   - Barcode stub: `flex flex-col` of spans with `style={{ flex: b.flex }}`,
     giving horizontal stripes down a vertical strip.

2. **`app/components/TripSearchSection.tsx`**
   - Add optional prop `compactPreview?: boolean`. When set, render a second
     stacked list **below** the existing mobile deck / desktop row, mapping the
     same `shown` array through `TripCardCompact` with the same `savedIds`,
     `pending`, `onOpen`, `onHeart`.
   - Reusing the section's existing state is what keeps the preview modal, the
     lazy itinerary fetch, and the heart optimistic updates working for free.

3. **`app/discover/page.tsx`** — pass `compactPreview`.

## Gotchas

- `CoverCarousel` is shared: guard every change behind a default so the tall card
  is byte-identical.
- Heart **and** carousel arrows need `stopPropagation` — the whole card is a
  click target that opens the preview modal.
- Cream card on the graphite canvas — same contrast situation as today's cards.
- Trips with one cover must hide arrows *and* dots (existing `images.length > 1`).

## Verification

- `npx tsc --noEmit` + lint clean.
- `/discover` serves 200 and shows **both** lists; home's cards unchanged.
- A 1-cover trip and a multi-cover trip (TKY-001 has several).
- Thai lines not clipped at the descenders/marks.
- Narrow mobile: the 132px thumb + text still fits without overflow.
