/**
 * Custom smooth-scroll (easeInOutCubic, 1200ms) — ported from the Kimi build.
 *
 * Shared so every in-page scroll uses the same easing: the landing's Learn More /
 * Start Journey cues and the navbar's Home tab. Native `scroll-behavior: smooth`
 * is deliberately not used — its curve and duration aren't controllable.
 * Falls back to an instant jump under prefers-reduced-motion.
 */
export function smoothScrollToY(targetY: number, duration = 1200) {
  const startY = window.scrollY
  const delta = targetY - startY
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.scrollTo(0, targetY)
    return
  }
  const startT = performance.now()
  const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
  requestAnimationFrame(function step(now: number) {
    const p = Math.min((now - startT) / duration, 1)
    window.scrollTo(0, startY + delta * easeInOutCubic(p))
    if (p < 1) requestAnimationFrame(step)
  })
}

/**
 * Scroll an element with the given id to the top of the viewport.
 * `offset` shifts the landing: positive lands that many px PAST the element's
 * top edge, negative stops short of it.
 */
export function smoothScrollTo(id: string, duration = 1200, offset = 0) {
  const el = document.getElementById(id)
  if (!el) return
  smoothScrollToY(window.scrollY + el.getBoundingClientRect().top + offset, duration)
}

/** Glide back to the top of the page (the hero). */
export function smoothScrollToTop(duration = 1200) {
  smoothScrollToY(0, duration)
}
