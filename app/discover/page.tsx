'use client'

import TripSearchSection from '@/app/components/TripSearchSection'

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
    // pt-26 (104px): the fixed navbar is 94px at rest, so this leaves a 10px
    // breath under it — any tighter and the title collides with the bar.
    // px-4 on mobile (was px-8): the compact cards are full-width rows, so the
    // page gutter is the only thing limiting how long they can run.
    <main className="min-h-screen px-4 pb-24 pt-26 text-briefing-cream sm:px-8">
      <div className="mx-auto w-full max-w-[1536px]">
        <TripSearchSection
          title="Ready-to-go Trips"
          subtitle="จัดทริปไว้ให้ พร้อมไปได้เลย!"
          callbackUrl="/discover"
          openFromQueryParam
          headingTag="h1"
          compactCards
        />
      </div>
    </main>
  )
}
