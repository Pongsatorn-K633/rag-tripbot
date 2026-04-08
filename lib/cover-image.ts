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
  stock4: 'Zen',
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

  // 3. Cloudinary delivery URL — inject smart-crop transformations.
  //    We upload originals unmodified, then at render time ask Cloudinary to
  //    crop to 4:5 using content-aware gravity (g_auto), auto-format (f_auto,
  //    serves WebP/AVIF where supported), and auto-quality (q_auto). This
  //    keeps the original in the media library and gives perfect crops.
  if (stored.includes('res.cloudinary.com') && stored.includes('/image/upload/')) {
    const TRANSFORMS = 'c_fill,g_auto,ar_4:5,f_auto,q_auto'
    // Only inject if not already transformed (naive check — looks for our marker)
    if (!stored.includes('c_fill,g_auto')) {
      return stored.replace('/image/upload/', `/image/upload/${TRANSFORMS}/`)
    }
  }

  // 4. Other raw URL (external, legacy lh3, etc.) — use as-is
  return stored
}

/**
 * Type guard: is the string a known IMG registry key (as opposed to a raw URL)?
 * Used by the admin picker to show which preset is currently selected.
 */
export function isCoverKey(value: string | null | undefined): value is TemplateCoverKey {
  return typeof value === 'string' && (TEMPLATE_COVER_KEYS as readonly string[]).includes(value)
}
