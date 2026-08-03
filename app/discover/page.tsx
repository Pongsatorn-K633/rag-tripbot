'use client'

import TripSearchSection from '@/app/components/TripSearchSection'

/** Seigaiha wallpaper — the whole /discover page sits on the classic wave-scale
 *  pattern (per the jap-discoverbg reference). True seigaiha geometry baked into
 *  ONE 200×100 tile: fans of radius 100 with evenly-spaced rings (every 15, down
 *  to a small centre dot), rows every 50 offset by half a fan, drawn top-row-
 *  first so each row's graphite fill occludes the row above — the cascading
 *  fish-scale look a simple offset-layer trick can't make. Cream strokes at
 *  whisper opacity; pure data-URI, zero requests. */
const SEIGAIHA_FAN =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='100'%3E%3Cdefs%3E%3Cg id='s' stroke='%23F7F9FC' stroke-opacity='.05' stroke-width='1.3'%3E%3Ccircle r='100' fill='%23334155'/%3E%3Cg fill='none'%3E%3Ccircle r='85'/%3E%3Ccircle r='70'/%3E%3Ccircle r='55'/%3E%3Ccircle r='40'/%3E%3Ccircle r='25'/%3E%3Ccircle r='10'/%3E%3C/g%3E%3C/g%3E%3C/defs%3E%3Cuse href='%23s' x='0' y='0'/%3E%3Cuse href='%23s' x='200' y='0'/%3E%3Cuse href='%23s' x='100' y='50'/%3E%3Cuse href='%23s' x='0' y='100'/%3E%3Cuse href='%23s' x='200' y='100'/%3E%3Cuse href='%23s' x='100' y='150'/%3E%3C/svg%3E"

/**
 * /discover — the full trip catalog on the same dark Midnight canvas as the
 * home page's Ready-to-go Trips section, driven by the SAME shared component
 * (search pill + filter modal + boarding-pass cards). Differences from home:
 * no `defaultCount` (all trips show, not just the newest 3), no "View all"
 * links (this IS all), and ?trip=CODE deep links auto-open the preview.
 */
export default function DiscoverPage() {
  return (
    // No bg here — ClientLayout's fixed canvas paints Graphite for this route,
    // so it covers the full viewport however short the content is.
    // pt-32 (128px): the fixed navbar is 94px at rest — this gives the title
    // a ~34px breath under it (was a tight 10px; user asked for more air,
    // matching the my-trip/create bump).
    // px-4 on mobile (was px-8): the compact cards are full-width rows, so the
    // page gutter is the only thing limiting how long they can run.
    // NO min-h-screen: it forced main to a full viewport on top of the 94px
    // navbar and the footer, so the page was always taller than the screen and
    // the footer sat just past the fold even with little content. Without it
    // the body's flex column stretches ClientLayout's flex-grow wrapper
    // instead, which parks the footer at the true bottom.
    <main className="px-4 pb-24 pt-32 text-briefing-cream sm:px-8">
      {/* Fixed wallpaper layer — above ClientLayout's graphite canvas (later
          in DOM at the same -z-10), below all content. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          backgroundImage: `url("${SEIGAIHA_FAN}")`,
          // Rendered at half the tile's native 200×100 — smaller scales (user call).
          backgroundSize: '100px 50px',
        }}
      />
      <div className="mx-auto w-full max-w-[1536px]">
        <TripSearchSection
          title="Ready-to-go Trips"
          subtitle="จัดทริปไว้ให้ พร้อมไปได้เลย!"
          callbackUrl="/discover"
          openFromQueryParam
          headingTag="h1"
          compactCards
          // Desktop-only sticky right panel: title + 3D map + region legend,
          // with regions as a multi-select filter on the card list. The whole
          // panel lives inside TripSearchSection — it needs the filter state.
          regionMap
        />
      </div>
    </main>
  )
}
