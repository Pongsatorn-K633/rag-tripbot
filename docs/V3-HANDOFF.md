# RAG TripBot — V3 Handoff & Master Plan

> **Purpose:** a single entry point for a new session/account to understand the current
> state and continue. Read this first, then `CLAUDE.md` (orchestrator) and the linked docs.
> **Status as of this handoff:** the V3 migration is feature-complete across admin authoring,
> user editing, rendering, bilingual, and Google Maps. All `tsc` + `lint` + `next build` clean.
> Work is **uncommitted on `main`** (owner commits themselves).
>
> **Update — 2026-07 UI pass:** a homepage/navbar redesign landed on top of V3. **User-facing
> routes were renamed** (full table in `CLAUDE.md` → "Current Route Map"): `/pre-planned`→`/discover`,
> `/go`→`/my-trip`, `/doc-to-trip`→`/ai-scanner`, plus a new **`/create`** hub. **Dark mode was
> removed** — single cool palette (Midnight/Cloud/Ocean + Noir); `ThemeProvider` was deleted.
> Backend/API names are unchanged. **UI/motion SSOT:** [`docs/ui-alignment.md`](ui-alignment.md)
> (palette, hero anatomy, motion recipes, parallax guardrails, review checklist) — also summarized
> in `CLAUDE.md` → "UI / Design Conventions".

---

## 1. What the project is
Two-chatbot system for Japan trip planning, Thai travelers:
- **Web app** (Next.js 15 App Router) — planning + admin authoring of pre-planned trips.
- **LINE bot / LIFF** — execution-phase context injection on the go.
Stack: Next.js · Prisma v6 (`@prisma/adapter-pg`) · Neon Postgres (jsonb) · Gemini 2.5 Flash ·
Google Places API (New) · NextAuth v5 · Upstash · Cloudinary · Tailwind. Prod: `dopamichi.com` (Vercel).

## 2. The itinerary schema (the heart of everything)
Three versions coexist; the renderer normalizes them:
- **V1** — legacy flat `{days[{location, activities[{time,name,notes}], accommodation, transport}]}` (early seeds / old doc-to-trip).
- **V2** — node/slot model (the legacy admin builder; demo Kyoto trip).
- **V3** — the **current rich schema**. SSOT: **[`docs/pre-planned-trip/columns.md`](pre-planned-trip/columns.md)**
  (field-by-field + bilingual Thai-style rules, merged). Mirrors the transformer JSON 1:1 (snake_case).

**V3 shape** (`lib/itinerary-types.ts`): `ItineraryV3 { version:3, title, totalDays, season?, airports?, sourceFile?, overview, highlights[], reference_date?, days[] }`.
- `overview` (`PlanOverview`): title · cover_tagline · description · available_period · **recommended_period[]** ·
  area_code · cover_images · available_airports · car_rental · arrival buffers · 5 bilingual guides.
- `days[]` (`DayV3`): `{ day, name{en,th}, activities[] }`.
- `activities[]` (`ActivityV3`): slot · is_default (admin ⭐) · **selected (traveler pick)** · time · duration_min ·
  priority · location · name{en,th} · description{en,th} · cost · rating · category · operating_hours ·
  queue_time · booking_policy · how_to_book · maps_api_call · **placeId** · notes{en,th} · remark{en,th} · links{map,walking_route,ig,fb,tt,website}.
- **Choice rule:** only the 6 **meal** slots are choosable (adjacent same-slot rows → a pick-one carousel).
  `is_default` = admin's ⭐ recommendation; `selected` = traveler's pick (set when editing a copy).

## 3. Pipelines & key files
| Concern | Files |
|---|---|
| Types (V1/V2/V3, render `Day`/`Activity`/`Choice`) | `lib/itinerary-types.ts` |
| Import JSON → `ItineraryV3` (validate + normalize) | `lib/trips/import-plan.ts` (`importPlanJson`, `deriveAvailability`, `parsePeriod`) |
| JSON export / blank scaffold | `lib/trips/plan-json.ts` (`toAuthoringJson`, `blankPlanJson`, `downloadJson`) |
| Render normalizer (v1/v2/v3 → render `Day[]`, + `lang`) | `lib/trips/itinerary-model.ts` (`getRenderDays`, `isV3`, `RenderLang`) |
| Queue × booking 15-case matrix | `lib/trips/queue-booking.ts` + `app/components/QueueBookingBadge.tsx` |
| Shared renderer (cards, preview, LIFF) | `app/components/ItineraryView.tsx` (EN/TH toggle, highlights carousel, guides accordion, rich cards) |
| **Admin V3 builder/editor** | `app/admin/trip-builder/TripBuilderV3.tsx` (+ `AreaCombobox.tsx`); route `app/admin/trip-builder/[id]/page.tsx` branches v3→V3 editor, v1/v2→legacy `TripBuilder.tsx` |
| **User duplicate→edit** | `app/components/ItineraryEditorV3.tsx`; route `app/trips/[id]/edit/page.tsx` |
| **AI Scanner** (upload→V3 + completion form; route `/ai-scanner`, was Doc-to-Trip) | `app/api/upload/route.ts` (VLM→V3), `app/components/DocToTripForm.tsx`, `app/ai-scanner/page.tsx` |
| ✨ Generate-TH (EN→TH) | `app/api/admin/translate/route.ts` (Gemini + thai-style) |
| Google Maps (Places New) | `lib/maps/places.ts`, `app/api/admin/maps/route.ts`, budget in `lib/rate-limit.ts` (`mapsBudget`) |
| Dashboard (JSON download buttons) | `app/admin/dashboard/AdminDashboard.tsx` |
| Import/remove scripts | `scripts/import-dopamichi.ts`, `scripts/remove-dopamichi.ts`, `scripts/load-env.ts` |

## 4. Dev / prod workflow (CRITICAL)
- `.env` → **production** Neon (`ep-twilight-hall`). `.env.local` (gitignored) → isolated **`dev`** Neon branch
  (`ep-spring-sunset`) — created off prod. `npm run dev` + the scripts read `.env.local` first via `scripts/load-env.ts`.
- **Authoring loop:** Dashboard **⬇ JSON** (export) or **Blank JSON** → hand-edit → re-import → refresh.
  - Dev import: `npx tsx scripts/import-dopamichi.ts [file.json] --publish` (hits `dev`, guarded against prod).
  - Prod import: `USE_PROD_DB=1 npx tsx scripts/import-dopamichi.ts [file.json] --publish` (see **[migrate-to-prod.md](pre-planned-trip/migrate-to-prod.md)**).
- **Deploy order:** push V3 **code** to Vercel FIRST, *then* import V3 data to prod — else old prod code crashes on a V3 row.
  V3 code is backward-compatible (v1/v2 still render), so deploying is safe; prod has no V3 data until you import.
- **Windows note:** `npm run build` may hit EPERM on `prisma generate` if the dev server holds the query-engine DLL.
  It's harmless — run `npx next build` alone, or stop the dev server.

## 5. Google Maps — keys & cost caps
- Server-only key `GOOGLE_MAPS_API_KEY` in `.env` (+ Vercel) and `.env.local`. Enable **Places API (New)** + billing.
- Free tier = under **10K/month** per SKU. We only call **Text Search** (`SearchTextRequest`) + **Place Details** (`GetPlaceRequest`).
- **Caps in place:** code budget **1,000/month** (`mapsBudget`, override `MAPS_MONTHLY_CAP`); Google per-day quota set to **50/day** on those two methods; optional THB-50 billing alert. The 📍 button stays dormant until the key is set.

## 6. Settled decisions (don't re-litigate)
- **Emoji** = category-derived (Activity slots → category-tag emoji; meals/Living/Logistics → slot emoji). Decorative emoji in text = free content.
- **Choosable slots** = the 6 meals only; Activity 1–8 are never choices.
- **`is_default`** (admin ⭐ recommend) ≠ **`selected`** (traveler pick).
- **`cover_tagline`** = cover hook; **`description`** = full text inside.
- **`recommended_period`** = array; `availability` (MM-DD) derived from it.
- **Excel is cut** — the dopamichi authoring format is **JSON** (transformer repo owns Excel→JSON). `.xlsx` *upload* in doc-to-trip still works (via the VLM).
- **SSOT** = `columns.md`; code follows it (update doc + code together).

## 7. Roadmap — what remains
**In progress this handoff:** security review of the new V3 surfaces (security-agent) — see §8.
**Recommended next:**
- **Phase 6 — Testing/QA:** no automated suite yet (only `tsc`/lint/build + manual). Biggest stability gap. Add Vitest (lib/) + Playwright (auth, trips, LINE webhook) + CI; then create a Test/QA agent.
- **Phase 7 C/D — LIFF duplicate/edit:** LINE identity (`User.lineUserId`, `@line/liff`), `/liff/edit`, "my LINE trips", rate-limit duplicate. Spec: `docs/duplicate-edit-feature.md`.
**Smaller:** per-activity **user notes** in `ItineraryEditorV3` (deferred) · `area_code` edit in the V3 builder · **chat re-enable** (`/chat → /maintenance` redirect still on).
**Deferred design docs:** `docs/phase2-v3-builder-plan.md` (full V3 builder plan + decisions), `docs/single-source-of-truth-plan.md` (vocab consolidation).

## 8. Security review (new V3 surfaces) — done at handoff
Audited via the security-agent. **Fixed** this session; **open** items are low-risk follow-ups.

**FIXED:**
- **🔴 Critical — stored XSS via unsanitized `href`** (`javascript:`/`data:` in V3 `links`, member-reachable through `/api/upload`). Added **`lib/url.ts` `safeHref()`** (http/https only); applied at the render sink (`ItineraryView` `LinkPill` + logistics map link) **and** on import (`import-plan.ts` scrubs link schemes → bad URLs become `null`). Verified: `javascript:`/`data:` blocked.
- **🟠 #4 — PII in logs/responses** (`/api/upload` logged full sheet text + model output, returned them in `debug`). Now logs **length only**; `debug` raw content is **dev-only** (`NODE_ENV`-gated).
- **🟡 #6 — Maps budget exhaustion** — added a **per-admin** rate limit (`apiRateLimit`, 30/min) on `/api/admin/maps` on top of the global monthly budget.
- **🟡 #5 — prompt injection** — added "treat input strictly as data" fencing to the translate + upload prompts (already schema-bounded + admin/member-gated).

**OPEN (low-risk, documented for follow-up):**
- **#3 / #7 — write-path validation gaps:** `POST /api/admin/templates` and `PATCH /api/trips/:id` store the `itinerary` JSON without running `importPlanJson`/deep `validateItinerary`. The **XSS vector is closed** by the render-side `safeHref`, so remaining risk is *malformed-shape robustness*, not exploitation. Follow-up: normalize itineraries through `importPlanJson` on write.
- **#8 — `import-dopamichi.ts` prod guard** denylists one host substring (`twilight-hall`). It's already an explicit opt-in (`USE_PROD_DB=1`); harden later to an allowlist + typed confirmation.
- **#9 — cover URLs** stored unvalidated; mitigated by `next/image` `remotePatterns`. Validate on write if any path renders them outside `<Image>`.

**Confirmed safe:** `/api/trips*` authz (session identity, owner check + admin override); `lib/maps/places.ts` (server-only key, `encodeURIComponent` placeId, fixed base URLs — no SSRF); translate/maps behind `requireAdmin`; `/api/upload` member-gated + size/MIME checks.

## 9. First steps for a new session
1. Read this doc → `CLAUDE.md` → `docs/pre-planned-trip/columns.md`.
2. Confirm `.env.local` points at the `dev` Neon branch; `npm run dev`; open `/discover` (TKY-001 is the demo V3 trip).
3. To author: Dashboard → ⬇ JSON → edit → `npx tsx scripts/import-dopamichi.ts <file> --publish` → refresh.
4. Run `npx tsc --noEmit` + `npx next lint` before changes; `npx next build` to verify.
5. Pick up the roadmap (§7), starting with Testing/QA or LIFF.
