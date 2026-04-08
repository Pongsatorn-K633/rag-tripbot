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
  return limiter.limit(identifier)
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
