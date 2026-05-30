# Feature: Duplicate & Edit (web + LINE LIFF, aligned)

Let a user **duplicate** a pre-planned trip (their own editable copy + activation code) and
make **light edits** — pick choices, set start date, reorder/remove activities, add notes —
on **both** the website and the LINE LIFF webapp, from one shared implementation.

## Status

| Phase | Scope | State |
|---|---|---|
| **A** | Shared edit core + web edit endpoints | ✅ Done |
| **B** | Shared `<ItineraryEditor>` + website edit page/entry | ✅ Done |
| **C** | LIFF identity + duplicate + edit (LINE) | ⏳ **Planned (resume here)** |
| **D** | Hardening (rate-limit, tests, "my LINE trips") | ⏳ Planned |

## Architecture (build once, two thin surfaces)

Web users and LINE users are **both `User` rows**, so ownership (`Trip.userId`) is identical.
Only **identity resolution** differs (web = NextAuth session; LIFF = LINE ID token).

```
SHARED CORE
  lib/trips/edit.ts        → validateItinerary(), updateTripItinerary(tripId, userId, …)
  lib/trips/duplicate.ts   → duplicateTemplate(templateId, userId)        [Phase C]
  app/components/ItineraryEditor.tsx  (theme-aware: variant='light'|'dark')
        ▲                                   ▲
  web surface (session)              LIFF surface (LINE ID token)
  PATCH /api/trips/[id]              POST /api/liff/duplicate, PATCH /api/liff/trip
  /trips/[id]/edit  + /go ✏️         /liff/edit  + "Duplicate & edit" button
```

## Done in A + B (files that already exist)

- `lib/itinerary-types.ts` — added `Choice.selected?: number` (non-destructive pick).
- `lib/trips/edit.ts` — `TripEditError`, `validateItinerary()`, `updateTripItinerary()`.
- `app/api/trips/[id]/route.ts` — added `GET` (owner/admin) + `PATCH` (owner) using the core.
- `app/components/ItineraryEditor.tsx` — shared editor: start date · pick choices · reorder
  (↑/↓, no drag lib) · remove · per-activity notes. `variant` light/dark.
- `app/trips/[id]/edit/page.tsx` — website edit page.
- `app/go/page.tsx` — Edit (✏️) button on trip cards (hidden when `locked`).
- `app/components/ChoiceCarousel.tsx` — shows "✓ เลือกแล้ว" badge + opens on `choice.selected`.

## Phase C — LIFF identity + duplicate + edit (resume here)

1. **DB (DB Agent):** `User.lineUserId String? @unique` → `npx prisma db push`. LINE-only users
   are lightweight "shadow" Users (email null, `isOnboarded: true`, name/picture from LINE).
2. **Install** `@line/liff`.
3. **Env:** `NEXT_PUBLIC_LIFF_ID` (client init) + `LINE_LIFF_CHANNEL_ID` = `2009712695`
   (numeric prefix of `LIFF_ID`; the ID-token audience to verify against).
4. **Identity (Auth/Admin Agent):** `lib/line/liff-auth.ts` →
   `verifyLiffIdToken(idToken)` POSTs `https://api.line.me/oauth2/v2.1/verify`
   (`id_token` + `client_id = LINE_LIFF_CHANNEL_ID`); **verify `aud`** ; returns
   `{ lineUserId, name, picture }`; then **find-or-create** `User` by `lineUserId`. Returns the User id.
5. **Duplicate core (lib):** `lib/trips/duplicate.ts` →
   `duplicateTemplate(templateId, ownerUserId)`: fetch template → create `Trip` (copy itinerary,
   `source:'plan'`, `templateId`, coverImage, title) owned by ownerUserId → mint a `shareCode`
   (reuse `lib/share-code.ts` minting) → return `{ trip, shareCode }`.
   *Also refactor the website "Confirm & Save" (`PlanPreviewModal`) onto this core so duplicate is
   genuinely one concept across both surfaces (server copies from template; client stops sending itinerary).*
6. **LIFF routes (LINE Agent):**
   - `POST /api/liff/duplicate` — body `{ idToken, templateShareCode | templateId }` → verify →
     shadow user → `duplicateTemplate` → **upsert `LineContext`** (lineId → new trip, auto-bind) →
     return `{ shareCode, tripId }`.
   - `PATCH /api/liff/trip` — body `{ idToken, tripId, itinerary, startDate, title }` → verify →
     resolve shadow user → `updateTripItinerary` (reuse core, owner check).
   - `GET` for loading a LINE-owned trip into the editor (owner check via idToken), or reuse
     `/api/trips/by-code` for read + idToken-gated edit.
7. **LIFF UI (LINE Agent):**
   - LIFF SDK init helper (`liff.init({ liffId })`, `liff.getIDToken()`).
   - "ทำสำเนา & แก้ไข · Duplicate & edit" button on `/liff/itinerary` → calls duplicate → opens editor.
   - `app/liff/edit/page.tsx` — reuses `<ItineraryEditor variant={theme}>` (LIFF theme store);
     shows the new activation code prominently; saves via `PATCH /api/liff/trip`.

## Phase D — Hardening

- Rate-limit `POST /api/liff/duplicate` (abuse / spam copies) via `lib/rate-limit.ts`.
- Server-side itinerary validation already in `validateItinerary` — extend if needed.
- Optional **"my LINE trips"** list in LIFF (query trips by the shadow user's `lineUserId`).
- **Security Agent review:** ID-token `aud` verification, ownership enforcement on edit,
  shareCode-as-capability (view) vs identity (edit), no secret leakage.

## Design decisions (locked)

1. **Shadow-user model** (`User.lineUserId`) — reuses Trip ownership, trip-lock, share-code, LineContext.
2. **`LINE_LIFF_CHANNEL_ID`** = `2009712695` for ID-token verification.
3. **Auto-bind `LineContext`** on duplicate (bot can answer about the new copy immediately).
4. **Reorder via ↑/↓ buttons** (no drag library) — mobile/LIFF friendly.
5. **Edits saved as full itinerary JSON** via one PATCH, validated server-side.

## Agent ownership

DB → `User.lineUserId` · Web → shared editor + duplicate core + web routes · LINE → LIFF
screens + `/api/liff/*` + `liff-auth` wiring · Auth/Admin → `liff-auth.ts` (verify + find-or-create) ·
Security → reviews token audience, ownership, rate-limit.
