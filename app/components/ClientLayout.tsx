'use client'

import { AnimatePresence, motion } from 'motion/react'
import { usePathname } from 'next/navigation'
import { useContext, useEffect, useState } from 'react'
import { LayoutRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { isGraphiteCanvas } from '@/lib/theme-routes'

/**
 * Freeze the App Router's LayoutRouterContext for the duration of a page-exit
 * animation.
 *
 * Without this, `AnimatePresence mode="wait"` breaks on client navigation: Next
 * swaps `children` to the NEW route's content immediately, so the page that's
 * still playing its exit animation renders the new tree (or an empty one). The
 * enter animation of the incoming page can then be interrupted and left stranded
 * at `initial={{ opacity: 0 }}` — an invisible page that reads as a frozen white
 * screen (seen navigating home → /discover → back to home).
 *
 * Snapshotting the context once at mount (each keyed page gets its own
 * FrozenRouter instance) and re-providing it keeps the exiting page rendering
 * its OWN content until the animation finishes, then the new route mounts
 * cleanly.
 */
function FrozenRouter({ children }: { children: React.ReactNode }) {
  const context = useContext(LayoutRouterContext ?? {})
  // Lazy initial state captures the context at this instance's first render and
  // never updates it — the "freeze". (A ref read during render trips
  // react-hooks/refs; state is the lint-clean way to hold a mount snapshot.)
  const [frozen] = useState(context)

  if (!frozen) return <>{children}</>

  return <LayoutRouterContext.Provider value={frozen}>{children}</LayoutRouterContext.Provider>
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // Home owns a full-viewport photo hero — the page-enter y-slide visibly drags
  // the hero upward when navigating back to it, so home transitions with a pure
  // fade. Other pages keep the subtle slide. (Keyed per pathname, so each page
  // instance carries its own enter/exit values through AnimatePresence.)
  const slide = pathname === '/' ? 0 : 10
  const isDark = isGraphiteCanvas(pathname)

  /**
   * Re-tint the browser's own chrome (iOS status bar / bottom toolbar) to match
   * whichever end of the page you're looking at: Midnight over a dark page, and
   * Cloud once the cream footer is on screen. iOS applies ONE theme-color to
   * both bars, so a single static value can only ever match one end.
   *
   * IntersectionObserver, not a scroll listener: this does no work at all while
   * scrolling — the browser calls back only when the footer crosses the
   * viewport edge, so there's no per-frame cost and no layout reads.
   */
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (!meta) return
    const pageTint = isDark ? '#122C4F' : '#F7F9FC'
    const footerTint = '#F7F9FC' // the footer is cream on every route
    meta.setAttribute('content', pageTint)

    // Null on /chat and /liff/*, where the Footer renders nothing.
    const footer = document.querySelector('footer')
    if (!footer || pageTint === footerTint) return

    const io = new IntersectionObserver(
      ([entry]) => meta.setAttribute('content', entry.isIntersecting ? footerTint : pageTint),
      { threshold: 0 },
    )
    io.observe(footer)
    return () => io.disconnect()
  }, [isDark, pathname])

  return (
    <>
      {/* Page CANVAS + transition backdrop, in one fixed layer.
          The page above fades to/from TRANSPARENT, so whatever sits behind it
          is what shows mid-transition. `body` is cream, which made dark→dark
          navigation (home ⇄ /discover) blink white. This layer tracks the
          route's canvas instead: dark→dark never changes colour (seamless), and
          light↔dark eases to the DESTINATION colour. It also IS the background
          for the dark pages — they don't set their own, so the canvas covers
          the full viewport no matter how short the content is.
          -z-10 paints it above the body background but below all content. */}
      <div
        aria-hidden
        className={`fixed inset-0 -z-10 transition-colors duration-300 ${
          isDark ? 'bg-graphite' : 'bg-briefing-cream'
        }`}
      />
      {/* NO exit animation, and no mode="wait".
          With them, the outgoing page stayed mounted for 300ms while the router
          had already reset the scroll to the top — so leaving a scrolled page
          flashed ITS top (home's photo hero) before the new route appeared.
          Mounting the new page immediately removes that window entirely; the
          incoming fade still covers the swap, over the canvas above. */}
      <AnimatePresence>
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: slide }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex-grow"
        >
          <FrozenRouter>{children}</FrozenRouter>
        </motion.div>
      </AnimatePresence>
    </>
  )
}
