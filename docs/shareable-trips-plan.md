# Trip URLs — Plan

> **Scope (2026-08-03): public sharing of a user's own trip is OUT.** Personal
> trips stay private to their owner. What remains is giving the trip view a URL
> so the browser behaves, plus optional link-preview polish for the pre-planned
> trips that are *already* public. Status: PLANNED.

---

## 1. Where we already are

| | Today | Verdict |
|---|---|---|
| **Pre-planned** (`Template`, /discover) | `/discover?trip=TKY-001` opens the preview; the modal's ⧉ button copies that URL; `GET /api/templates/[id]` is public (`published: true`) | **No new URL needed.** It already works for signed-out visitors. Only polish remains (§3). |
| **User trip** (`Trip`, /my-trips) | No URL at all — the view modal is local state (`viewingTripId`) | **Needs a URL** (owner-only, not a share link) — §2 |

---

## 2. The one thing to build: `/my-trips?trip=<id>`

Not for sharing — for the browser. Today the trip view is invisible to the URL bar, so:

- **Back** leaves the site instead of closing the trip
- **Refresh** drops you back to the bare list
- you can't bookmark or re-open a trip you were reading
- the LINE bot / an email can't link the owner to their own trip

Fix: `?trip=<tripId>` drives `viewingTripId` — push on open, `popstate` closes. It mirrors
/discover's existing `openFromQueryParam` pattern, so both pages speak the same vocabulary.

Still owner-only: `GET /api/trips` is session-scoped, so a stranger with the URL sees
nothing. ~15 lines in [app/my-trips/page.tsx](../app/my-trips/page.tsx), no schema change,
no new endpoint.

---

## 3. Optional polish for the already-public pre-planned trips

Not required, no URL change — do it whenever the marketing matters:

- **Link previews.** A pasted `/discover?trip=TKY-001` renders as bare text in LINE/FB
  because /discover is a client page with no per-trip OG tags. A server route
  `app/trip/[code]/page.tsx` with `generateMetadata()` (cover image + tagline) would make
  shared links render as cards, and open the trip directly instead of booting the whole
  catalogue first. `?trip=` keeps working either way.

---

## 4. If public sharing of personal trips is ever revisited

Keeping the finding, because it's the part that isn't obvious:

**`Trip.shareCode` (e.g. `TKY-492`) must NOT be used as a public link.** It is the LINE
activation code — `/activate TKY-492` in a chat binds that chat to the trip
([webhook](../app/api/line/webhook/route.ts)). It is 7 characters and it grants *bot
access*, not just reading. A public link would need a separate, long, revocable
`viewToken` on `Trip`, a sanitised `GET /api/public/trips/[token]` (no `userId`, no email,
no `shareCode`), a `noindex` page, and share/revoke UI.

The questions that would have to be answered first — all moot while sharing is out:

1. Does a shared trip reveal the traveller's **flights** (`itinerary.flight`) and the
   **owner's name/avatar**? (Fine for travel companions, less so posted publicly.)
2. Can a viewer **duplicate** someone's shared trip?
3. Route naming (`/t/<token>` vs `/shared/<token>`) and token expiry.
