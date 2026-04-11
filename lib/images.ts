/**
 * Central image registry.
 *
 * All scenic images now point to Cloudinary (permanent, optimized).
 * The old lh3.googleusercontent.com URLs were temporary Gemini Stitch
 * previews that could expire at any time.
 *
 * CLOUDINARY_URL env var is parsed automatically by next-cloudinary.
 * Cloud name: dubett62q
 */

export const CLOUDINARY_CLOUD = 'dubett62q'

/** Build a Cloudinary delivery URL with sane defaults. */
export function cld(
  publicId: string,
  opts: { w?: number; h?: number; crop?: string } = {},
) {
  const { w, h, crop = 'fill' } = opts
  const transforms = ['f_auto', 'q_auto']
  if (w) transforms.push(`w_${w}`)
  if (h) transforms.push(`h_${h}`)
  if (w || h) transforms.push(`c_${crop}`)
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/upload/${transforms.join(',')}/dopamichi/${publicId}`
}

// Cloudinary URLs — permanent, optimized scenic images
const CLD_HOKKAIDO = 'https://res.cloudinary.com/dubett62q/image/upload/q_auto/f_auto/v1775941309/hokkaido_woibhv.jpg'
const CLD_KYOTO = 'https://res.cloudinary.com/dubett62q/image/upload/q_auto/f_auto/v1775941309/20221009_185503_37323ab7_w1920_gkhahc.webp'
const CLD_TORII = 'https://res.cloudinary.com/dubett62q/image/upload/v1775942239/homeHERO_g6xadq.jpg'
const CLD_FUJI = 'https://res.cloudinary.com/dubett62q/image/upload/q_auto/f_auto/v1775941821/jpeg_large_202112291737-94b1bc95b0fa46be3b8d4899657dcd1b_g6kjrq.jpg'
const CLD_TOKYONIGHT = 'https://res.cloudinary.com/dubett62q/image/upload/q_auto/f_auto/v1775942067/nsplsh_36554c7933707875784c38_mv2_d_4997_3084_s_4_2_lj2aty.jpg'

/**
 * Named image slots. All scenic images use Cloudinary (permanent URLs).
 * Logo uses a local /public/ file (never expires, zero CDN dependency).
 */
export const IMG = {
  // ── Home page ──────────────────────────────────────────────────────────────
  homeHero: CLD_TORII,
  homeTokyo: CLD_TOKYONIGHT,
  homeKyoto: CLD_KYOTO,
  homeFuji: CLD_FUJI,

  // ── LIFF itinerary page ────────────────────────────────────────────────────
  liffHero: CLD_TORII,

  // ── Dopamichi logo ─────────────────────────────────────────────────────────
  // Served from /public/ — permanent, no CDN dependency, no expiring URLs.
  logo: '/android-chrome-192x192.png',

  // ── Stock photo pool ───────────────────────────────────────────────────────
  // Used as fallback covers for trips/templates without a custom coverImage.
  // Now that templates use direct Cloudinary URLs, these are mainly for
  // hash-based fallbacks in resolveCoverImage().
  stock1: CLD_HOKKAIDO,
  stock2: CLD_KYOTO,
  stock3: CLD_FUJI,
  stock4: CLD_TORII,
} as const
