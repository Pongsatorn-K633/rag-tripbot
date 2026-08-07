'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useSession, signIn } from 'next-auth/react'
import { useSavedTemplates } from '@/app/hooks/useSavedTemplates'
import { TripCardCompact } from '@/app/components/TripDeck'
import type { PlanTemplate } from '@/app/components/PlanCard'
import PlanPreviewModal from '@/app/components/PlanPreviewModal'
import SeigaihaBackdrop from '@/app/components/SeigaihaBackdrop'

/**
 * /saved — the templates the user hearted.
 *
 * Same dark canvas + compact boarding-pass cards as /discover (it IS a slice of
 * /discover, filtered to the hearts), so the two pages read as one catalogue
 * rather than two galleries with different card vocabularies.
 */
export default function SavedPage() {
  const { status } = useSession()
  const { savedIds, pending, toggleHeart } = useSavedTemplates('/saved')
  const [templates, setTemplates] = useState<PlanTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/templates')
        if (!res.ok) throw new Error('Failed to load')
        const data = await res.json()
        setTemplates(data.templates ?? [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const saved = useMemo(() => templates.filter((t) => savedIds.has(t.id)), [templates, savedIds])
  const selectedTemplate = selectedId ? templates.find((t) => t.id === selectedId) ?? null : null
  const signedOut = status === 'unauthenticated'

  return (
    // pt-32 / pb-24 / header mb-16 — the dark pages' shared vertical rhythm.
    <main className="pt-32 pb-24 px-4 sm:px-6 max-w-7xl mx-auto text-briefing-cream">
      <SeigaihaBackdrop />

      <header className="mb-16">
        {/* Title row with the right-aligned "Discover →" shortcut, exactly like
            /my-trips and /ai-scanner. */}
        <div className="flex items-center gap-4">
          <h1 className="font-headline font-bold text-3xl md:text-5xl tracking-tight">
            Saved
          </h1>
          <Link
            href="/discover"
            // translate-y: nudged down off the title's optical centre so it
            // sits nearer the type's baseline than its cap height.
            className="group ml-auto flex shrink-0 translate-y-1.5 items-center gap-1.5 font-headline text-xs font-bold tracking-wide text-briefing-cream/80 transition-colors hover:text-basel-brick"
          >
            Discover
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
        <p className="mt-2.5 text-briefing-cream/70 font-sans">
          แพลนพร้อมเที่ยวที่คุณกดหัวใจเก็บไว้ — กดหัวใจซ้ำเพื่อนำออก
        </p>
      </header>

      {signedOut ? (
        <div className="rounded-2xl border-2 border-dashed border-white/20 p-8 text-center sm:p-16">
          <p className="mb-2 font-sans text-lg text-briefing-cream/70">
            เข้าสู่ระบบเพื่อดูแพลนที่คุณบันทึกไว้
          </p>
          <p className="mb-6 font-sans text-sm text-briefing-cream/50">
            Sign in to see the trips you hearted
          </p>
          <button
            onClick={() => signIn(undefined, { callbackUrl: '/saved' })}
            className="rounded-full bg-basel-brick px-8 py-3 font-detail text-sm font-semibold text-white shadow-md shadow-basel-brick/25 transition-colors hover:bg-zen-black"
          >
            Sign in
          </button>
        </div>
      ) : loading ? (
        // Mirrors TripCardCompact's silhouette (centred max-w-md rows, square
        // cover on the right, barcode stub) so nothing re-lays-out on arrival.
        <div className="flex flex-col items-center gap-5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex w-full max-w-md animate-pulse overflow-hidden rounded-xl bg-briefing-cream shadow-[0_10px_30px_rgba(0,0,0,0.28)]"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex min-w-0 flex-row-reverse">
                  <div className="w-[144px] shrink-0 pb-1 pl-3 pr-1.5 pt-3">
                    <div className="aspect-square w-full rounded-lg bg-zen-black/10" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col pb-1.5 pl-3 pt-3">
                    <div className="h-3 w-24 rounded bg-zen-black/10" />
                    <div className="mt-2 h-px bg-zen-black/15" />
                    <div className="my-2.5 h-4 w-3/4 rounded bg-zen-black/15" />
                    <div className="h-px bg-zen-black/15" />
                    <div className="mt-2 h-3 w-full rounded bg-zen-black/10" />
                    <div className="mt-1.5 h-3 w-2/3 rounded bg-zen-black/10" />
                  </div>
                </div>
                <div className="mt-auto border-t border-zen-black/15 px-3 py-2">
                  <div className="h-3 w-44 rounded bg-zen-black/10" />
                  <div className="mt-2 h-3 w-28 rounded bg-zen-black/10" />
                </div>
              </div>
              <div className="w-7 shrink-0 border-l border-dashed border-zen-black/25 bg-zen-black/5" />
            </div>
          ))}
        </div>
      ) : saved.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-white/20 p-8 text-center sm:p-16">
          <p className="mb-2 font-sans text-lg text-briefing-cream/70">ยังไม่มีแพลนที่บันทึกไว้</p>
          {/* Two elements, not one with a line break: a newline inside JSX text
              collapses to a space, so the Thai and English ran together on one
              line. Same Thai-then-English stack as the signed-out state. */}
          <p className="font-sans text-sm text-briefing-cream/50">
            กดรูปหัวใจบนแพลนที่ชอบเพื่อเก็บไว้ที่นี่
          </p>
          <p className="mb-6 mt-1 font-sans text-sm text-briefing-cream/50">
            Heart a trip to save it here
          </p>
          <Link
            href="/discover"
            className="inline-flex items-center gap-2 rounded-full bg-basel-brick px-8 py-3 font-detail text-sm font-semibold text-white shadow-md shadow-basel-brick/25 transition-colors hover:bg-zen-black"
          >
            เลือกแพลนพร้อมเที่ยว
            <ArrowRight className="size-4" />
          </Link>
        </div>
      ) : (
        // One centred column of compact boarding passes — the /discover list
        // shape (was a 4-up grid of tall PlanCards).
        <div className="flex flex-col items-center gap-5">
          {saved.map((tpl) => (
            <TripCardCompact
              key={tpl.id}
              tpl={tpl}
              saved={savedIds.has(tpl.id)}
              isPending={pending.has(tpl.id)}
              onOpen={(id) => setSelectedId(id)}
              onHeart={(id, e) => toggleHeart(id, e)}
            />
          ))}
        </div>
      )}

      <PlanPreviewModal
        template={selectedTemplate}
        callbackUrl="/saved"
        onClose={() => setSelectedId(null)}
      />
    </main>
  )
}
