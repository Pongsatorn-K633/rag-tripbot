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
   * BOTTOM overscroll on dark pages. iOS paints the rubber-band zone from the
   * root background-COLOR alone — one colour for both ends, and it ignores
   * everything else out there (phone-verified, all three: a fixed-attachment
   * 50/50 gradient; a fixed block parked under the viewport, culled as a
   * never-visible layer; a 100vh footer box-shadow, clipped from the bounce
   * compositing). So dark-top + cream-bottom is only possible by CHANGING that
   * one colour with scroll position. Unlike the old theme-color meta retint
   * (which iOS ignores), root background changes are ordinary CSS repaints —
   * iOS honours them.
   *
   * Cream ONLY at the absolute bottom, not "footer visible": iOS's bottom
   * browser chrome wears this same colour, and creaming it while the footer
   * is merely approaching reads as a white bar stuck to a dark page. At the
   * true bottom the chrome overlays the cream footer, so it blends. A page
   * too short to scroll never creams — its top bounce (graphite, status bar)
   * outranks its bottom corner.
   *
   * The inline style overrides the SSR <style> below; the cleanup clears it
   * on every route change so a stranded cream can't survive navigation.
   */
  useEffect(() => {
    if (!isDark) return
    const html = document.documentElement
    const apply = () => {
      const scrollable = html.scrollHeight > window.innerHeight
      const atBottom = window.innerHeight + window.scrollY >= html.scrollHeight - 2
      html.style.backgroundColor = scrollable && atBottom ? '#F7F9FC' : ''
    }
    apply()
    window.addEventListener('scroll', apply, { passive: true })
    window.addEventListener('resize', apply)
    return () => {
      window.removeEventListener('scroll', apply)
      window.removeEventListener('resize', apply)
      html.style.backgroundColor = ''
    }
  }, [isDark, pathname])

  return (
    <>
      {/* ROOT canvas colour, per route. iOS paints the status-bar area and the
          overscroll bounce from the DOCUMENT ROOT background — not from the
          theme-color meta (it ignores JS updates to it on client navigation)
          and not from the viewport-only fixed canvas div below. This <style>
          ships in the SSR HTML (correct on hard load) and re-renders with the
          pathname (correct after client navigation). body stays TRANSPARENT in
          globals.css — an opaque body would paint over the -z-10 canvas div
          and turn the dark pages white.

          SOLID colour only — never a gradient. A fixed-attachment 50/50
          gradient was tried for two-tone bounce colours: iOS ignores it in
          the bounce zone (background-color only there) AND leaks its cream
          half as a white band behind the bottom browser chrome on dark
          routes, in the strip the -z-10 canvas div doesn't cover. Two-tone
          bounce is handled by the at-bottom colour swap above instead. */}
      <style>{`html{background-color:${isDark ? '#334155' : '#F7F9FC'}}`}</style>
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
      {/* BOTTOM overscroll: handled by a 100vh cream box-shadow on Footer.tsx —
          NOT a fixed block parked below the viewport (tried; iOS culls
          never-visible fixed layers from the bounce compositing, so it never
          showed). The TOP bounce needs nothing: the <html> background above
          already matches each page's top. */}
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
