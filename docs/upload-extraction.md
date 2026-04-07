# Upload & Extraction — Summary

Quick reference for the `/upload` flow built in Phase 4. If you're returning
to this after a break, read this first.

---

## What it does

User drops a file on `/upload` → server extracts a structured itinerary
matching the project-wide JSON contract → user reviews → saves as a Trip
with a share code.

## Accepted file types

| Kind        | Extensions                | Path                                           |
|-------------|---------------------------|------------------------------------------------|
| Image       | `.png .jpg .jpeg .webp`   | Inline → Gemini 2.5 Flash (vision)             |
| PDF         | `.pdf`                    | Inline → Gemini 2.5 Flash (native PDF support) |
| Spreadsheet | `.xlsx .xls`         | SheetJS → CSV text → Gemini 2.5 Flash (text)   |

Max upload: **10 MB** (enforced both client-side and server-side).

## Why no separate OCR engine

Gemini 2.5 Flash handles "OCR + understanding" in a single pass, including
Thai text. Running Tesseract/PaddleOCR first and feeding text to an LLM
loses layout context and produces worse extractions. For spreadsheets,
SheetJS parses cells locally (free, instant) — no model needed for that
step, only for the final JSON normalization.

---

## Files involved

- `app/upload/page.tsx` — drag-and-drop UI, client-side validation, debug panel
- `app/api/upload/route.ts` — MIME-based routing, SheetJS parsing, prompt assembly
- `lib/llm/client.ts` — `generateText` and `generateFromFile` Gemini wrappers

## Routing logic (server)

```
classify(file) →
  image  → generateFromFile(prompt, base64, mimeType)
  pdf    → generateFromFile(prompt, base64, 'application/pdf')
  sheet  → spreadsheetToText(buffer) → generateText(prompt + csv)
  other  → 415 unsupported
```

`spreadsheetToText` walks every sheet in the workbook, converts each to CSV
via `XLSX.utils.sheet_to_csv`, and concatenates with `### Sheet: <name>`
headers. Capped at 12000 chars.

---

## Gemini call inventory — every LLM call in the app

All calls use `model: gemini-2.5-flash`, `temperature: 0.3`, 60s timeout.
"Thinking" column shows whether Gemini 2.5 Flash internal reasoning is on.

| # | Caller (file) | Feature it powers | Status | Wrapper | Purpose | maxOutputTokens | Thinking | Tools |
|---|---|---|---|---|---|---|---|---|
| 1 | `lib/rag/extractor.ts:24` | **วางแผนการเดินทาง** (General AI planner via `/api/chat`) | 🛠️ Maintenance | `generateText` | Extract structured query intent (month, duration, vibe) from user message | **4096** | on | — |
| 2 | `lib/rag/assembler.ts:24` | **วางแผนการเดินทาง** (General AI planner via `/api/chat`) | 🛠️ Maintenance | `generateText` | Assemble final itinerary JSON from retrieved blocks + web results | **8192** | on | — |
| 3 | `lib/line/injector.ts:101` | **LINE bot** — fast-path answer from saved Trip JSON | ✅ Active | `generateText` | Intent classify + answer in one call (Thai chat replies) | **4096** | on | — |
| 4 | `lib/rag/web-search.ts:36` | **LINE bot** — enriched path with Google Search grounding | ✅ Active | `generateWithSearch` (direct `ai.models.generateContent`) | Grounded answer when Trip JSON lacks the info | **4096** | on | `googleSearch` |
| 5 | `app/api/upload/route.ts:123` (image) | **มีแผนอยู่แล้ว? อัปโหลดที่นี่** (Upload flow) | ✅ Active | `generateFromFile` | Extract itinerary JSON from image (OCR + reasoning in one pass) | **8192** | **off** | — |
| 6 | `app/api/upload/route.ts:130` (PDF) | **มีแผนอยู่แล้ว? อัปโหลดที่นี่** (Upload flow) | ✅ Active | `generateFromFile` | Extract itinerary JSON from PDF (native, no OCR) | **8192** | **off** | — |
| 7 | `app/api/upload/route.ts:142` (xlsx) | **มีแผนอยู่แล้ว? อัปโหลดที่นี่** (Upload flow) | ✅ Active | `generateText` (with opts) | Normalize SheetJS CSV → itinerary JSON | **8192** | **off** | — |

> **Note:** The **เลือกแพ็คเกจสำเร็จรูป** (curated templates) flow makes **zero LLM calls** — templates are static data in `app/templates/page.tsx`. The user just clicks one and it's saved straight to the DB.

### Summary by intent

- **Reasoning / answer-generation tasks** (rows 1–4): **4096–8192** tokens, thinking **on**. Budget is shared between thinking + visible output, so 2048 is too tight; 4096 is the safe minimum, 8192 only where the visible answer itself can be long (assembler).
- **Structured extraction tasks** (rows 5–7): 8192 tokens, thinking **off**. Pure transcription work — no thinking needed, and disabling it prevents the silent token-budget drain that caused the empty-response bug.

### Knobs to tune later

- Row 4 (`generateWithSearch`) still hard-codes its config — if you ever want per-call tuning like `generateText`, refactor it to accept an `opts` argument.
- Rows 1–2 only matter if/when the General AI planner comes out of maintenance.
- Input tokens are not capped on our side — Gemini 2.5 Flash supports up to 1M input tokens, far beyond anything we send. The `sheetText` slice cap (12000 chars) is the only effective input limit.

---

## Gemini config — important gotchas

Both extraction calls use these settings:

- `model: 'gemini-2.5-flash'`
- `maxOutputTokens: 8192`
- `thinkingConfig: { thinkingBudget: 0 }` ← **disable thinking**

### Why disable thinking for extraction

Gemini 2.5 Flash has "thinking" enabled by default. Thinking tokens are
counted against `maxOutputTokens` and consumed *before* any visible text is
emitted. With small budgets (e.g. 4096) the entire allowance can be spent
on internal reasoning, leaving `response.text` empty — which is exactly
what produced the `Unexpected end of JSON input` error during testing.

Rule of thumb:
- **Disable thinking** for transcription/extraction/formatting/translation
- **Leave thinking on** for reasoning, planning, RAG answer synthesis

The chat/RAG callers of `generateText` still use the default (thinking on,
2048 tokens). Only the upload route opts in via
`generateText(prompt, { maxOutputTokens: 8192, disableThinking: true })`.

---

## Debugging

Two channels exist for inspecting what the model received and returned:

1. **Server console** — `/api/upload` logs:
   - File metadata + classified kind
   - SheetJS-extracted CSV text (spreadsheet path only)
   - Gemini raw output with character count

2. **Browser UI** — the `/upload` page shows a collapsible
   "🔍 Debug — what the model received & returned" panel:
   - In the **review state** (success): collapsed by default, below the itinerary card
   - In the **error state** (failure): expanded by default, below the error banner

The API returns the `debug` field on **both** success and 500 responses,
so empty/malformed Gemini outputs are visible in the UI without needing
the server log.

---

## Itinerary JSON contract

All paths produce JSON matching the contract in `CLAUDE.md`:

```json
{
  "title": "string",
  "totalDays": 5,
  "season": "Winter | Spring | Summer | Autumn",
  "days": [
    {
      "day": 1,
      "location": "City",
      "activities": [{ "time": "HH:MM", "name": "...", "notes": "..." }],
      "accommodation": "...",
      "transport": "..."
    }
  ],
  "shareCode": null
}
```

`shareCode` is filled in later by `/api/activate` after the user confirms.

---

## Today's session — what changed

1. **Homepage UI** (`app/page.tsx`)
   - "วางแผนการเดินทาง" demoted to a disabled-looking placeholder ("อยู่ระหว่างการปรับปรุง")
   - "เลือกแพ็คเกจสำเร็จรูป" promoted to the gold primary CTA
   - Buttons reduced to `py-2`, container uses `sm:items-center` so each
     button respects its own height instead of stretching

2. **Templates page nav** (`app/templates/page.tsx`)
   - Top-right "วางแผนเองด้วย AI →" replaced with "มีแผนอยู่แล้ว? อัปโหลดที่นี่ →"
     pointing to `/upload`

3. **Upload route rewrite** (`app/api/upload/route.ts`)
   - Added MIME-based routing for image / PDF / spreadsheet
   - Added SheetJS spreadsheet parsing
   - Added `debug` payload returned on both success and error
   - Added 10 MB cap and 415 unsupported-type response

4. **LLM client** (`lib/llm/client.ts`)
   - Added `generateFromFile(prompt, base64, mimeType)` for arbitrary
     inline files (used by image + PDF paths)
   - `generateText` now accepts optional `{ maxOutputTokens, disableThinking }`
   - Both extraction paths now use 8192 tokens with thinking disabled

5. **Upload page** (`app/upload/page.tsx`)
   - Accepts `.webp .xlsx .xls` in addition to PDF/PNG/JPG
   - Helper text and info callout updated
   - Debug panel UI added (collapsible on success, auto-open on error)

6. **Dependency added:** `xlsx` (SheetJS)
