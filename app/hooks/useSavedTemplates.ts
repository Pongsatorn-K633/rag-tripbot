'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession, signIn } from 'next-auth/react'

interface SavedTripSlim {
  id: string
  templateId: string | null
  source: string | null
}

/**
 * Shared "hearted templates" state for the pre-planned + saved pages.
 * Tracks which template IDs the signed-in user has saved (hearted) and exposes
 * an optimistic toggle. `callbackUrl` is where sign-in returns to.
 */
export function useSavedTemplates(callbackUrl: string) {
  const { data: session } = useSession()
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState<Set<string>>(new Set())

  /** Re-derive the hearted set from the DB — the single source of truth. */
  const refresh = useCallback(async () => {
    const res = await fetch('/api/trips', { cache: 'no-store' })
    if (!res.ok) throw new Error(`GET /api/trips → ${res.status}`)
    const data = await res.json()
    return new Set<string>(
      (data.trips as SavedTripSlim[])
        .filter((t) => t.source === 'template' && t.templateId)
        .map((t) => t.templateId as string)
    )
  }, [])

  useEffect(() => {
    if (!session?.user) {
      setSavedIds(new Set())
      return
    }
    let active = true
    refresh()
      .then((ids) => {
        if (active) setSavedIds(ids)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [session, refresh])

  const toggleHeart = useCallback(
    async (templateId: string, e?: React.MouseEvent) => {
      e?.stopPropagation()
      if (!session?.user) {
        signIn(undefined, { callbackUrl })
        return
      }
      if (pending.has(templateId)) return

      const isSaved = savedIds.has(templateId)
      setPending((prev) => new Set(prev).add(templateId))
      setSavedIds((prev) => {
        const next = new Set(prev)
        if (isSaved) next.delete(templateId)
        else next.add(templateId)
        return next
      })

      try {
        const res = await fetch(`/api/templates/${templateId}/save`, {
          method: isSaved ? 'DELETE' : 'POST',
          // Belt and braces: a heart is a cookie-authenticated write, and a
          // request that silently went out without the session cookie is
          // exactly the failure mode that looks like "it saved, then didn't".
          credentials: 'same-origin',
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ? `${body.error} (${res.status})` : `HTTP ${res.status}`)
        }

        // Confirm against the DB instead of trusting the optimistic flip. A 200
        // that didn't actually write (or a write that something else undid) used
        // to leave the heart red until the next page load, which read as "it
        // saved and then lost it". Now the UI can only ever show what the server
        // will still say after a refresh.
        const confirmed = await refresh()
        setSavedIds(confirmed)
        if (confirmed.has(templateId) === isSaved) {
          throw new Error(
            isSaved
              ? 'เซิร์ฟเวอร์ยังเก็บทริปนี้อยู่ · the server still has this trip saved'
              : 'เซิร์ฟเวอร์ไม่ได้บันทึกทริปนี้ · the server did not keep this trip'
          )
        }
      } catch (err) {
        setSavedIds((prev) => {
          const next = new Set(prev)
          if (isSaved) next.add(templateId)
          else next.delete(templateId)
          return next
        })
        const detail = err instanceof Error ? err.message : String(err)
        console.error('[heart] toggle failed', { templateId, isSaved, detail })
        alert(`ไม่สามารถบันทึกได้ กรุณาลองใหม่\n\n${detail}`)
      } finally {
        setPending((prev) => {
          const next = new Set(prev)
          next.delete(templateId)
          return next
        })
      }
    },
    [session, callbackUrl, pending, savedIds, refresh]
  )

  return { savedIds, pending, toggleHeart, isSignedIn: !!session?.user }
}
