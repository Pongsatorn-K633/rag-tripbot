import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * Rate limiting via Upstash Redis (HTTP-based, edge-compatible).
 *
 * Two limiters are exported:
 *
 *   - `authRateLimit`   — sliding window, 5 requests per 10 minutes per
 *     identifier. Used on the Resend magic link send flow to prevent
 *     email spam / user enumeration. Tight to discourage brute force.
 *
 *   - `apiRateLimit`    — sliding window, 30 requests per minute per
 *     identifier. Used on /api/upload (expensive VLM calls) to prevent
 *     runaway Gemini bills from a compromised account or a pathological
 *     client.
 *
 * Identifiers:
 *   - For auth: the email address the magic link is being sent to
 *     (prevents hammering a specific victim inbox), falling back to IP
 *   - For API: the authenticated user.id (falls back to IP for
 *     unauthenticated endpoints, though we don't use it there)
 *
 * Graceful degradation: if UPSTASH_REDIS_* env vars are missing (local
 * dev without a Redis account), the limiters are `null` and the `limit()`
 * wrapper always allows the request. The app doesn't crash — it just
 * runs without rate limiting. Production must set the env vars.
 */

const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN

const redis = hasUpstash ? Redis.fromEnv() : null

export const authRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '10 m'),
      analytics: true,
      prefix: 'dopamichi:auth',
    })
  : null

export const apiRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, '1 m'),
      analytics: true,
      prefix: 'dopamichi:api',
    })
  : null

/**
 * `activateRateLimit` — 8 requests per 10 minutes per LINE user. Gates the
 * `/activate <code>` command so a malicious user can't brute-force the short
 * share-code space by spraying guesses at the bot. Legit users activate rarely.
 */
export const activateRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(8, '10 m'),
      analytics: true,
      prefix: 'dopamichi:activate',
    })
  : null

/**
 * `codeLookupRateLimit` — 30 requests per minute per IP. Gates the public
 * `GET /api/trips/by-code` read path (the LIFF itinerary view) so the share
 * code can't be enumerated over plain HTTP without a LINE account. Generous
 * enough for shared carrier/NAT IPs, far too tight to sweep the code space.
 */
export const codeLookupRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, '1 m'),
      analytics: true,
      prefix: 'dopamichi:code-lookup',
    })
  : null

/**
 * `mapsBudget` — a MONTHLY call budget for the Google Places API (New) so the app
 * never crosses the free 10K/month tier. Fixed 30-day window, keyed globally (one
 * shared budget, not per-user). Default 1,000 (well under the 10K free tier — raise
 * later via MAPS_MONTHLY_CAP). Best-effort only — it FAILS OPEN if Upstash is down,
 * so a Billing budget alert / API quota in Google Cloud is the guaranteed backstop.
 */
const MAPS_CAP = Math.max(1, parseInt(process.env.MAPS_MONTHLY_CAP ?? '1000', 10) || 1000)
export const mapsBudget = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(MAPS_CAP, '30 d'),
      analytics: true,
      prefix: 'dopamichi:maps',
    })
  : null

/**
 * Helper that checks a rate limiter and returns a typed result. Use in API
 * routes like:
 *
 *   const { success, reset, remaining } = await checkLimit(apiRateLimit, userId)
 *   if (!success) return NextResponse.json({ error: '...' }, { status: 429 })
 */
export async function checkLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<{ success: boolean; remaining: number; reset: number; limit: number }> {
  if (!limiter) {
    // No Upstash configured — skip rate limiting but warn in dev logs
    if (process.env.NODE_ENV === 'development') {
      console.warn('[rate-limit] UPSTASH_REDIS_* not set — rate limiting disabled')
    }
    return { success: true, remaining: Infinity, reset: 0, limit: Infinity }
  }
  try {
    return await limiter.limit(identifier)
  } catch (err) {
    // Upstash configured but unreachable (deleted DB / DNS / outage). FAIL OPEN —
    // a throttle backend being down must never take down the feature it guards.
    // Throttling is a best-effort safeguard, not an auth gate. Logged for visibility.
    console.error('[rate-limit] limiter unreachable — allowing request (fail-open):', err)
    return { success: true, remaining: Infinity, reset: 0, limit: Infinity }
  }
}

/**
 * Extract a stable identifier from a Request for IP-based rate limiting.
 * Looks at common proxy headers first (Vercel / Cloudflare), falls back to
 * a placeholder string if nothing is available.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const real = req.headers.get('x-real-ip')
  if (real) return real
  return 'unknown-ip'
}
