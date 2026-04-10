/**
 * Central image registry.
 *
 * Currently points to Google's lh3 CDN (temporary — these are preview URLs
 * from Gemini Stitch, not a stable CDN). To migrate a single image to
 * Cloudinary, upload it under the `dopamichi/` folder with the matching
 * name, then replace the URL below with `cld('home/hero')` etc.
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

/**
 * Named image slots. Swap a value from the lh3 URL to cld('slot-name')
 * once you've uploaded the matching asset to Cloudinary.
 */
export const IMG = {
  // ── Home page ──────────────────────────────────────────────────────────────
  // Hero square — "Japanese Aesthetic" (also used as stock4 in gallery/templates)
  homeHero: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBJoB4l__7CGeBwDH-1F9DLRXraV8oTWWIQhnRT-wFjZXgeYhFxzRj1UPdWtsjrJwzPY_nJCxPggyMRO2HicZ46sMQ46yfBkXJZp_h6El3PhhmD7jD5x8DHzbg28ggYJk66nyqfeS1PHaUZdJJF-zgZzZ9lDLdeZmrqoNpe6VyRkW90txVkWOyhUa91fHobWJ60IcBN7kaJtz90Yy-1-ZHdknA8-1EhFlfDRWyXInPdmbuFHb28mGlG6OLu0nWyQCcFwkxLNAZIj2I',
  // "Tokyo Nights" content grid image
  homeTokyo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDSa7YDcURCpy0Wm7s3a5PSe9ksTOQ7W4Fnk9kYSHl2FTh3QyXRlj6rCqmjivf6k7O8CNF5-D-PJu_sX1PnLOu20joPnHjwl97OscaE7DIc5hNkCsbw8P7q0MbUM6AZqbyACBSfAQLMXiy45hCyx_rNDuO7btx6vOoMSku4KqiBfTMdiQmqWujM3OXO6KsdJ01OwYaeSJwzPbVcXgjC2eclt2jomaGT0YC0pPOYncWmPmnCh1Y2i6kc70Hk_tS_JVwNDCPGzjjO3I0',
  // "Zen Heritage" / Kyoto content grid image
  homeKyoto: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCxFRsn5dtUEI4vZg41hADO5jcg4pN_nrbQ1xqFGmqUyI25fmgQ3pZKm6aDRXNynxwknWoNFHFwS7m40ro70zZ-j3h2j5S0V7tAVOthQ1_OALIJu1sXHqaWDhtlXQKxis5rYFFsMGwB8ykIX3sMU_2qSDKmctZC0Eb2QeQoezzJsPHUVPsUHJz8svaw7bWGmJVWKPRGG_SXaoN_fS6DnR51GEL4cJ7IBT6oy8UDkoPHupZzgrtTCmHQ0djcCBKlhR4TBhaJobhRSCU',
  // "The Peak" / Fuji content grid image
  homeFuji: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAeNFmn6hrqUijedUroFFfMv4bMQA0ngDCzNNjHUfiT7APaow_2ZpZOeoEE7QFNWCxwgf3Gz6gN06M4_fXwhu5o3gx8142S5ydgLsrP_LxD_EYKHbOqQPiK__7fFDKgcJpxjBJqHK6i6KSq2yT3EBHZejcx9mgz6lLSh5hPBaGVaBBUtFWRCs8SotqtgVoMFMHwUMUbRH4E0A6jGijymNc32fUuBNs06lMJN2TJeJchcTqvXMzVN0X8NDA_upP-x0C8urk6F4B8RhQ',

  // ── LIFF itinerary page ────────────────────────────────────────────────────
  // Hero background — Japan scenery
  liffHero: 'https://lh3.googleusercontent.com/aida-public/AB6AXuATw90m5PYZIo_nX274DHOFpi_jrovymhssMZsnw4xYN3b7vSX-3Z7SqGdEZg_W1HqCUvHu7ophYzUILFV_Ku7tnghUy10JChBv2lO_dbupxpWKzBrzcR0qNvd85lacsFu-ORqST1CaGIbT2YcfofOFXCDAP9-fjqN0krp1e5WL8S67j-zn6xjJjpSBr45UPq9x-ah51yV0VJf5NuaPOtx_TUZ0sDvODKq5i4JLe1SNqa3wS3Re2QWsSlRwbYw-YqhFz6GTk9i4_lU',

  // ── Dopamichi logo ─────────────────────────────────────────────────────────
  // Used in Navbar, Footer, gallery upload panel background, and LIFF top bar.
  // Served from /public/ — permanent, no CDN dependency, no expiring URLs.
  logo: '/android-chrome-192x192.png',

  // ── Stock photo pool ───────────────────────────────────────────────────────
  // Reused across gallery/page.tsx (STOCK_IMAGES) and templates/page.tsx (TEMPLATE_IMAGES).
  // stock1–4 are aliases; the underlying URLs are the same as the home images.
  // gallery order:   [stock1, stock2, stock3, stock4]  → [Tokyo, Kyoto, Fuji, homeHero]
  // templates order: [stock1, stock3, stock2, stock4]  → [Tokyo, Fuji, Kyoto, homeHero]
  stock1: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDSa7YDcURCpy0Wm7s3a5PSe9ksTOQ7W4Fnk9kYSHl2FTh3QyXRlj6rCqmjivf6k7O8CNF5-D-PJu_sX1PnLOu20joPnHjwl97OscaE7DIc5hNkCsbw8P7q0MbUM6AZqbyACBSfAQLMXiy45hCyx_rNDuO7btx6vOoMSku4KqiBfTMdiQmqWujM3OXO6KsdJ01OwYaeSJwzPbVcXgjC2eclt2jomaGT0YC0pPOYncWmPmnCh1Y2i6kc70Hk_tS_JVwNDCPGzjjO3I0',
  stock2: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCxFRsn5dtUEI4vZg41hADO5jcg4pN_nrbQ1xqFGmqUyI25fmgQ3pZKm6aDRXNynxwknWoNFHFwS7m40ro70zZ-j3h2j5S0V7tAVOthQ1_OALIJu1sXHqaWDhtlXQKxis5rYFFsMGwB8ykIX3sMU_2qSDKmctZC0Eb2QeQoezzJsPHUVPsUHJz8svaw7bWGmJVWKPRGG_SXaoN_fS6DnR51GEL4cJ7IBT6oy8UDkoPHupZzgrtTCmHQ0djcCBKlhR4TBhaJobhRSCU',
  stock3: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAeNFmn6hrqUijedUroFFfMv4bMQA0ngDCzNNjHUfiT7APaow_2ZpZOeoEE7QFNWCxwgf3Gz6gN06M4_fXwhu5o3gx8142S5ydgLsrP_LxD_EYKHbOqQPiK__7fFDKgcJpxjBJqHK6i6KSq2yT3EBHZejcx9mgz6lLSh5hPBaGVaBBUtFWRCs8SotqtgVoMFMHwUMUbRH4E0A6jGijymNc32fUuBNs06lMJN2TJeJchcTqvXMzVN0X8NDA_upP-x0C8urk6F4B8RhQ',
  stock4: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBJoB4l__7CGeBwDH-1F9DLRXraV8oTWWIQhnRT-wFjZXgeYhFxzRj1UPdWtsjrJwzPY_nJCxPggyMRO2HicZ46sMQ46yfBkXJZp_h6El3PhhmD7jD5x8DHzbg28ggYJk66nyqfeS1PHaUZdJJF-zgZzZ9lDLdeZmrqoNpe6VyRkW90txVkWOyhUa91fHobWJ60IcBN7kaJtz90Yy-1-ZHdknA8-1EhFlfDRWyXInPdmbuFHb28mGlG6OLu0nWyQCcFwkxLNAZIj2I',
} as const
