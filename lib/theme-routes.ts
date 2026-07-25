/**
 * Which routes render on the dark Graphite canvas (#334155).
 *
 * Single source of truth for ClientLayout's transition backdrop, the Navbar bar
 * colour, and the Footer — they must agree or a page shows a light bar over a
 * dark page (or flashes cream mid-navigation).
 *
 * ADD A NEW DARK PAGE HERE, and give its own text colours the light treatment.
 */
export const GRAPHITE_ROUTES = ['/discover', '/my-trip', '/create']

/** Dark page → the Navbar bar and Footer take the Graphite treatment. */
export function isGraphiteRoute(pathname: string): boolean {
  return GRAPHITE_ROUTES.includes(pathname)
}

/**
 * Routes whose page CANVAS is dark — the graphite routes plus home.
 *
 * Home is deliberately not in `GRAPHITE_ROUTES`: its navbar stays transparent
 * over the photo hero, and its lower gradient resolves to Cloud, so its footer
 * must stay cream for that seam to work. Only the canvas behind it is dark.
 */
export function isGraphiteCanvas(pathname: string): boolean {
  return pathname === '/' || isGraphiteRoute(pathname)
}
