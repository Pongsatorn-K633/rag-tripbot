/**
 * Return a URL only if it's a safe http(s) link — otherwise undefined.
 * Neutralizes `javascript:` / `data:` / `vbscript:` hrefs (stored-XSS) at the
 * render boundary. Use for EVERY `href` built from itinerary/user data, and to
 * scrub link fields on write. `target="_blank" rel="noopener"` does NOT block
 * `javascript:` execution — scheme validation is the only reliable guard.
 */
export function safeHref(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  const s = url.trim()
  if (!s) return undefined
  try {
    const proto = new URL(s).protocol.toLowerCase()
    return proto === 'http:' || proto === 'https:' ? s : undefined
  } catch {
    return undefined // relative/garbage → not a safe external link
  }
}
