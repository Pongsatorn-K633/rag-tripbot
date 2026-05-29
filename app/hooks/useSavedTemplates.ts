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

  useEffect(() => {
    if (!session?.user) {
      setSavedIds(new Set())
      return
    }
    let active = true
    fetch('/api/trips')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data) return
        const ids = new Set<string>(
          (data.trips as SavedTripSlim[])
            .filter((t) => t.source === 'template' && t.templateId)
            .map((t) => t.templateId as string)
        )
        setSavedIds(ids)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [session])

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
        })
        if (!res.ok) throw new Error('save failed')
      } catch {
        setSavedIds((prev) => {
          const next = new Set(prev)
          if (isSaved) next.add(templateId)
          else next.delete(templateId)
          return next
        })
        alert('ไม่สามารถบันทึกได้ กรุณาลองใหม่')
      } finally {
        setPending((prev) => {
          const next = new Set(prev)
          next.delete(templateId)
          return next
        })
      }
    },
    [session, callbackUrl, pending, savedIds]
  )

  return { savedIds, pending, toggleHeart, isSignedIn: !!session?.user }
}
