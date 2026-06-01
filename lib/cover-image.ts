import { IMG } from './images'

/**
 * Template cover image resolver.
 *
 * `Template.coverImage` in the DB can hold any of the following:
 *
 *   1. A short IMG registry KEY like `"stock1"` — preferred. Admins pick
 *      from a curated set in the template form; updating the URL in
 *      lib/images.ts automatically propagates to every template using it.
 *
 *   2. A full URL (Cloudinary, external, or legacy `lh3.googleusercontent`)
 *      — used when an admin uploads a custom cover for a specific template.
 *
 *   3. `NULL` / empty — falls back to a deterministic image chosen by
 *      hashing the template id, so the same template always gets the same
 *      placeholder no matter where it renders.
 *
 * `resolveCoverImage()` below normalizes all three cases to a concrete URL.
 */

// Subset of IMG keys that are appropriate as template covers. Add more keys
// here if you add scenic images to lib/images.ts and want admins to pick them.
export const TEMPLATE_COVER_KEYS = ['stock1', 'stock2', 'stock3', 'stock4'] as const

export type TemplateCoverKey = (typeof TEMPLATE_COVER_KEYS)[number]

// Human-readable labels shown under each thumbnail in the admin picker.
export const COVER_LABELS: Record<TemplateCoverKey, string> = {
  stock1: 'Tokyo',
  stock2: 'Kyoto',
  stock3: 'Fuji',
  stock4: 'Torii',
}

/**
 * Resolve a stored cover value (IMG key, URL, or null) to a final URL.
 *
 * @param stored        The raw value from `Template.coverImage`
 * @param fallbackSeed  Stable identifier used to pick a placeholder when
 *                      `stored` is empty. Pass the template's `id` so the
 *                      same template always gets the same placeholder.
 */
export function resolveCoverImage(
  stored: string | null | undefined,
  fallbackSeed: string
): string {
  // 1. Empty → deterministic hash fallback
  if (!stored) {
    let hash = 0
    for (let i = 0; i < fallbackSeed.length; i++) {
      hash = (hash * 31 + fallbackSeed.charCodeAt(i)) | 0
    }
    const key = TEMPLATE_COVER_KEYS[Math.abs(hash) % TEMPLATE_COVER_KEYS.length]
    return IMG[key]
  }

  // 2. Known IMG registry key — look up live URL
  if (stored in IMG) {
    return IMG[stored as keyof typeof IMG]
  }

  // 3. Cloudinary delivery URL.
  //    - If it already carries an explicit transform (e.g. a manual `c_crop`
  //      from the cover cropper), use it AS-IS — the admin framed it on purpose.
  //    - Otherwise it's a raw upload: inject smart-crop to 4:5 using content-aware
  //      gravity (g_auto), auto-format (f_auto → WebP/AVIF) and auto-quality (q_auto).
  if (stored.includes('res.cloudinary.com') && stored.includes('/image/upload/')) {
    const firstSeg = stored.split('/image/upload/')[1]?.split('/')[0] ?? ''
    if (!isCloudinaryTransformSegment(firstSeg)) {
      const TRANSFORMS = 'c_fill,g_auto,ar_4:5,f_auto,q_auto'
      return stored.replace('/image/upload/', `/image/upload/${TRANSFORMS}/`)
    }
    return stored
  }

  // 4. Other raw URL (external, legacy lh3, etc.) — use as-is
  return stored
}

// ── Cloudinary crop helpers (non-destructive, transform-based) ───────────────

const CLOUDINARY_UPLOAD = '/image/upload/'

/** Is this the first path segment after /image/upload/ a transform (not a version/public_id)? */
function isCloudinaryTransformSegment(seg: string): boolean {
  // Transforms contain comma-joined params like c_/w_/x_/g_; versions look like "v123".
  return /(?:^|,)(?:c|w|h|x|y|ar|g|f|q|e|r|b)_/.test(seg)
}

/** True for a Cloudinary delivery URL (so the cropper/Adjust button only show for these). */
export function isCloudinaryUrl(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.includes('res.cloudinary.com') && value.includes(CLOUDINARY_UPLOAD)
}

/**
 * Strip a leading transform segment so we get back the ORIGINAL asset URL — used
 * to (re-)load the full image into the cropper, so crop coordinates always map
 * to the source pixels no matter how many times it's been re-framed.
 */
export function stripCloudinaryTransform(url: string): string {
  const i = url.indexOf(CLOUDINARY_UPLOAD)
  if (i < 0) return url
  const prefix = url.slice(0, i + CLOUDINARY_UPLOAD.length)
  let rest = url.slice(i + CLOUDINARY_UPLOAD.length)
  // A crop can chain components (c_crop,.../c_scale,...) — strip every leading
  // transform segment until we hit the version/public_id.
  for (;;) {
    const slash = rest.indexOf('/')
    if (slash < 0) break
    if (!isCloudinaryTransformSegment(rest.slice(0, slash))) break
    rest = rest.slice(slash + 1)
  }
  return prefix + rest
}

/**
 * Bake a manual crop into a Cloudinary URL as a `c_crop` transform (coordinates
 * are natural-image pixels from react-easy-crop). The chained `c_scale,w_1080`
 * caps delivery size; resolveCoverImage then serves it as-is (already 4:5).
 */
export function buildCloudinaryCropUrl(
  url: string,
  area: { x: number; y: number; width: number; height: number }
): string {
  const base = stripCloudinaryTransform(url)
  if (!base.includes(CLOUDINARY_UPLOAD)) return url
  const r = (n: number) => Math.max(0, Math.round(n))
  const t = `c_crop,x_${r(area.x)},y_${r(area.y)},w_${r(area.width)},h_${r(area.height)}/c_scale,w_1080,f_auto,q_auto`
  return base.replace(CLOUDINARY_UPLOAD, `${CLOUDINARY_UPLOAD}${t}/`)
}

/**
 * Resolve a cover GALLERY to a list of final URLs (for the swipeable preview hero).
 *
 * Prefers the `images` array; falls back to the single `primary` cover; and if
 * both are empty, returns a one-item array with the deterministic placeholder so
 * the hero always has something to show.
 */
export function resolveCoverImages(
  images: string[] | null | undefined,
  primary: string | null | undefined,
  fallbackSeed: string
): string[] {
  const list = images && images.length > 0 ? images : primary ? [primary] : []
  if (list.length === 0) return [resolveCoverImage(null, fallbackSeed)]
  return list.map((img) => resolveCoverImage(img, fallbackSeed))
}

/**
 * Type guard: is the string a known IMG registry key (as opposed to a raw URL)?
 * Used by the admin picker to show which preset is currently selected.
 */
export function isCoverKey(value: string | null | undefined): value is TemplateCoverKey {
  return typeof value === 'string' && (TEMPLATE_COVER_KEYS as readonly string[]).includes(value)
}
