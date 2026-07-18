/**
 * Global next/image loader — bypasses Vercel's Image Optimization entirely
 * (its Hobby quota is 5K transformations/month and we exhausted it re-encoding
 * files Cloudinary had ALREADY optimized).
 *
 * - Cloudinary URLs: chain `w_<width>,c_limit,f_auto,q_auto` so Cloudinary does
 *   the responsive resizing itself (c_limit never upscales). Inserted before
 *   the version segment so existing transforms (card/hero crops, admin
 *   c_crop framing) keep applying to the original first.
 * - Everything else (local files, Google avatars): served as-is. Google already
 *   sizes avatars; local assets are few and small.
 *
 * Result: ZERO Vercel transformations, for good.
 */
const UPLOAD = '/image/upload/'

export default function imageLoader({ src, width }: { src: string; width: number; quality?: number }): string {
  if (src.includes('res.cloudinary.com') && src.includes(UPLOAD)) {
    const [prefix, rest] = src.split(UPLOAD)
    const segs = rest.split('/')
    const step = `w_${width},c_limit,f_auto,q_auto`
    const vIdx = segs.findIndex((s) => /^v\d+$/.test(s))
    segs.splice(vIdx >= 0 ? vIdx : segs.length - 1, 0, step)
    return `${prefix}${UPLOAD}${segs.join('/')}`
  }
  return src
}
