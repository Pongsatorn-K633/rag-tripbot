'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowRight, Plane } from 'lucide-react'
import PlanPreviewModal from '@/app/components/PlanPreviewModal'
import SeigaihaBackdrop from '@/app/components/SeigaihaBackdrop'
import { MyTripCardCompact } from '@/app/components/TripDeck'
import ConfirmDialog from '@/app/components/ConfirmDialog'
import { motion, AnimatePresence } from 'motion/react'
import { useSession, signIn } from 'next-auth/react'
import { resolveCoverImage } from '@/lib/cover-image'
import type { Itinerary, AnyItinerary } from '@/lib/itinerary-types'

// ── Types ────────────────────────────────────────────────────────────────────

interface SavedTrip {
  id: string
  title: string
  createdAt: string
  itinerary: Itinerary
  startDate?: string | null
  source?: string | null
  shareCode?: string | null
  templateId?: string | null
  coverImage?: string | null
  totalDays?: number | null
  locked?: boolean
}

export default function GoPage() {
  const { data: session, status } = useSession()
  const isSignedIn = !!session?.user

  const [trips, setTrips] = useState<SavedTrip[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [viewingTripId, setViewingTripId] = useState<string | null>(null)
  const [generatingCode, setGeneratingCode] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  // Copy "/activate <code>" to the clipboard and flash a "copied" indicator.
  function copyCode(code: string, e?: React.MouseEvent) {
    e?.stopPropagation() // don't open/close the view modal
    navigator.clipboard.writeText(`/activate ${code}`)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode((c) => (c === code ? null : c)), 1800)
  }

  async function handleGenerateCode(tripId: string, e: React.MouseEvent) {
    e.stopPropagation() // don't open the view modal
    setGeneratingCode(tripId)
    try {
      const trip = trips.find((t) => t.id === tripId)
      const primaryCity = (trip?.itinerary as Itinerary | null)?.days?.[0]?.location ?? 'JPN'
      const res = await fetch('/api/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId, primaryCity }),
      })
      if (!res.ok) throw new Error('Generate failed')
      const { shareCode } = await res.json()
      setTrips((prev) =>
        prev.map((t) => (t.id === tripId ? { ...t, shareCode } : t))
      )
    } catch {
      alert('ไม่สามารถสร้างรหัสได้ กรุณาลองใหม่')
    } finally {
      setGeneratingCode(null)
    }
  }

  // ── The open trip lives in the URL (?trip=<id>) ────────────────────────────
  // Not a share link — the trip is still owner-only (GET /api/trips is
  // session-scoped, so a stranger with this URL sees nothing). It exists so the
  // BROWSER behaves: Back closes the trip instead of leaving the site, a
  // refresh reopens it, and a trip can be bookmarked. Read via window, not
  // useSearchParams — that would need a Suspense boundary (same call the
  // /discover deep link makes).
  const pushedRef = useRef(false)
  useEffect(() => {
    const sync = () => {
      const id = new URLSearchParams(window.location.search).get('trip')
      setViewingTripId(id)
      if (!id) pushedRef.current = false
    }
    sync() // deep link on first load
    window.addEventListener('popstate', sync) // Back / Forward
    return () => window.removeEventListener('popstate', sync)
  }, [])

  function openTrip(id: string) {
    setViewingTripId(id)
    window.history.pushState(null, '', `?trip=${id}`)
    pushedRef.current = true
  }

  /** Close the trip view. If we pushed the entry, POP it so Back doesn't walk
   *  the user through every trip they opened; if they arrived on a deep link
   *  there's nothing of ours to pop, so just clean the URL. */
  function closeTrip() {
    if (pushedRef.current) {
      pushedRef.current = false
      window.history.back() // popstate → sync() clears the state
      return
    }
    setViewingTripId(null)
    window.history.replaceState(null, '', '/my-trips')
  }

  useEffect(() => {
    if (status === 'loading') return
    if (!isSignedIn) { setLoading(false); return }
    async function loadTrips() {
      try {
        const res = await fetch('/api/trips')
        if (!res.ok) throw new Error('Failed to load')
        const data = await res.json()
        // Show ALL user trips — uploads, chat, and template-sourced.
        // Template-sourced trips are real travel plans (user will edit + generate LINE code).
        setTrips(data.trips ?? [])
      } catch { /* silent */ } finally { setLoading(false) }
    }
    loadTrips()
  }, [isSignedIn, status])

  async function handleDelete(id: string) {
    setDeleting(true)
    try {
      const res = await fetch(`/api/trips/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (res.status === 409) {
          setDeleteConfirm(null)
          alert(body.error ?? 'This trip is published as a template and cannot be deleted.')
          return
        }
        throw new Error(body.error ?? 'Delete failed')
      }
      setDeleteConfirm(null)
      // Leave the trip view if the delete was raised from inside it — closeTrip
      // (not setViewingTripId) so the URL drops ?trip=<deleted id> as well.
      if (viewingTripId === id) closeTrip()
      setTrips((prev) => prev.filter((t) => t.id !== id))
    } catch {
      alert('ไม่สามารถลบแผนได้ กรุณาลองใหม่')
      setDeleteConfirm(null)
    } finally { setDeleting(false) }
  }

  function formatDateRange(startDateStr: string, days: number): string {
    const start = new Date(startDateStr)
    const end = new Date(startDateStr)
    end.setDate(end.getDate() + days - 1)
    const fmt = (d: Date) => d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
    return `${fmt(start)} - ${fmt(end)}`
  }

  return (
    // Dark page — ClientLayout paints the Graphite canvas for this route. The
    // trip cards below stay WHITE surfaces with their own dark text; only the
    // page-level type flips to Cloud.
    // pt-32 / pb-24 / header mb-16 — /discover's exact vertical rhythm, so the
    // three dark pages sit at the same distance from the navbar and give their
    // content the same breath below the heading.
    <main className="pt-32 pb-24 px-4 sm:px-6 max-w-7xl mx-auto text-briefing-cream">
      <SeigaihaBackdrop />
      {/* Hero — the SAME type scale as /discover's "Ready-to-go Trips"
          (font-headline bold, 3xl→5xl, tracking-tight) with its subtitle
          treatment, so the three dark pages read as one family. */}
      <header className="mb-16">
        {/* Title row — the "Discover →" shortcut rides on the TITLE's line,
            right-aligned (the mirror of /discover's "My Trips →", so the two
            pages point at each other). */}
        <div className="flex items-center gap-4">
          <h1 className="font-headline font-bold text-3xl md:text-5xl tracking-tight">
            My Trips
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
          ทริปของคุณ — แก้ไขได้อิสระ และสามารถคัดลอก share code (Ex. TKY-XXXX) เพื่อใช้งานแชทบอทบน LINE ได้เลย!
        </p>
      </header>

      {/* Sign-in CTA for guests */}
      {!isSignedIn && !loading && (
        <div className="border-2 border-dashed border-white/20 rounded-xl p-8 sm:p-16 text-center mb-20">
          <Plane size={40} className="mx-auto mb-4 text-briefing-cream/30" />
          <p className="text-briefing-cream/70 text-lg mb-2 font-sans">สมัครสมาชิกเพื่อดูแผนการเดินทางของคุณ</p>
          <p className="text-briefing-cream/50 text-sm mb-6">Sign in to see your saved trips</p>
          <button
            onClick={() => signIn(undefined, { callbackUrl: '/my-trips' })}
            className="px-8 py-4 bg-basel-brick text-white font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black transition-all"
          >
            Sign in
          </button>
        </div>
      )}

      {/* Loading skeleton — mirrors MyTripCardCompact's silhouette EXACTLY
          (centred max-w-md column, square cover on the right, title rule pair,
          bottom band, barcode stub). It used to be the pre-redesign 4-up grid
          of tall tiles, so the page visibly re-laid itself out the moment the
          trips arrived. Same wrapper classes as the real list. */}
      {loading && (
        <div className="flex flex-col items-center gap-5">
          {[1, 2, 3].map((i) => (
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
      )}

      {/* Trip grid */}
      {isSignedIn && !loading && (
        <>
          {trips.length === 0 ? (
            <div className="border-2 border-dashed border-white/20 rounded-xl p-8 sm:p-16 text-center">
              <p className="text-briefing-cream/70 font-sans text-lg mb-2">ยังไม่มีแผนการเดินทาง</p>
              <p className="text-briefing-cream/50 font-sans text-sm mb-6">
                สร้างแผนได้จาก <Link href="/discover" className="text-basel-brick underline">แพลนพร้อมเที่ยว</Link>&nbsp;,&nbsp;&nbsp;หากมีแผนอยู่แล้วอัปโหลดที่นี่เลย <Link href="/ai-scanner" className="text-basel-brick underline">AI Scanner</Link>
              </p>
            </div>
          ) : (
            // One column of compact boarding passes (max-w-md each), centred —
            // the same list shape /discover uses, instead of the old 4-up grid
            // of tall tiles.
            <div className="flex flex-col items-center gap-5">
              <AnimatePresence mode="popLayout">
                {trips.map((trip, idx) => {
                  const itin = trip.itinerary as Itinerary | null
                  // Seed the fallback with the source template so a duplicated trip
                  // shows the SAME cover as the pre-planned trip it came from.
                  const imgSrc = resolveCoverImage(trip.coverImage, trip.templateId ?? trip.id)
                  const tripTotalDays = itin?.totalDays ?? trip.totalDays ?? null
                  // V3 trips carry a cover caption + tagline in their overview;
                  // v1/v2 simply have none and those rows stay empty.
                  const ov = (itin as { overview?: { cover_places?: string[]; cover_images?: string[]; cover_tagline?: string; description?: string } } | null)?.overview
                  return (
                    <motion.div
                      key={trip.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.85, y: -30, filter: 'blur(8px)', transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } }}
                      transition={{ layout: { duration: 0.45, ease: [0.4, 0, 0.2, 1] } }}
                      className="w-full max-w-md"
                    >
                      <MyTripCardCompact
                        id={trip.id}
                        title={trip.title}
                        coverSrc={imgSrc}
                        // The trip's own gallery (inherited from its template),
                        // resolved the same way the single cover is.
                        coverImages={(ov?.cover_images ?? [])
                          .map((c) => resolveCoverImage(c, trip.templateId ?? trip.id))
                          .filter(Boolean)}
                        coverPlaces={ov?.cover_places ?? []}
                        totalDays={tripTotalDays}
                        dateLabel={trip.startDate && tripTotalDays ? formatDateRange(trip.startDate, tripTotalDays) : null}
                        ownerName={session?.user?.name ?? session?.user?.email ?? 'คุณ'}
                        ownerImage={session?.user?.image}
                        tagline={ov?.cover_tagline ?? ov?.description ?? null}
                        place={ov?.cover_places?.[0] ?? null}
                        shareCode={trip.shareCode}
                        locked={trip.locked}
                        generating={generatingCode === trip.id}
                        copied={copiedCode === trip.shareCode}
                        editHref={trip.locked ? undefined : `/trips/${trip.id}/edit`}
                        onView={() => openTrip(trip.id)}
                        onDelete={trip.locked ? undefined : () => setDeleteConfirm(trip.id)}
                        onCopyCode={(e: React.MouseEvent) => copyCode(trip.shareCode!, e)}
                        onGenerateCode={(e: React.MouseEvent) => handleGenerateCode(trip.id, e)}
                      />
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          )}
        </>
      )}

      {/* Delete confirmation dialog */}

      {/* Trip view — the SAME fullscreen modal /discover uses for a
          pre-planned trip (hero carousel, Overview/Itinerary tabs, day
          timeline). The saved trip is handed over as a template-shaped object
          with its itinerary already loaded, so nothing is fetched; viewOnly
          hides the Duplicate flow (this trip IS the copy), and the overview
          additionally shows its travel dates + flights. */}
      {(() => {
        const trip = trips.find((t) => t.id === viewingTripId)
        const itin = trip?.itinerary as Itinerary | null
        const ov = (itin as { overview?: { cover_places?: string[]; cover_images?: string[]; cover_tagline?: string; description?: string } } | null)?.overview
        const days = itin?.totalDays ?? trip?.totalDays ?? itin?.days?.length ?? 1
        return (
          <PlanPreviewModal
            template={
              trip
                ? {
                    id: trip.id,
                    title: trip.title,
                    description: ov?.cover_tagline ?? ov?.description ?? null,
                    itinerary: itin ?? undefined,
                    coverImage: trip.coverImage ?? null,
                    coverImages: (ov?.cover_images ?? []).map((c) => resolveCoverImage(c, trip.templateId ?? trip.id)),
                    coverPlaces: ov?.cover_places ?? [],
                    totalDays: days,
                    season: itin?.season ?? null,
                    availability: null,
                    shareCode: itin?.shareCode ?? trip.shareCode ?? null,
                    createdAt: trip.createdAt,
                  }
                : null
            }
            viewOnly
            travelDateLabel={trip?.startDate ? formatDateRange(trip.startDate, days) : null}
            // Published trips are locked (a template points at them), so they
            // offer no delete — same rule the card's hover icons follow.
            onDeleteTrip={trip && !trip.locked ? () => setDeleteConfirm(trip.id) : undefined}
            // Once a trip is YOURS the back face reads as your notes, not an
            // admin's pitch — /discover keeps the default "Admin Review".
            reviewTitle="Notes:"
            savedTrip
            callbackUrl="/my-trips"
            onClose={closeTrip}
          />
        )
      })()}

      {/* Delete confirm — MUST render after the trip modal above: both are
          z-[70], so the later sibling wins the paint order. Placed before it,
          the dialog opened UNDERNEATH the modal (invisible until you closed
          it, then stranded on the page). */}
      <ConfirmDialog
        open={!!deleteConfirm}
        tone="danger"
        title="ยืนยันการลบ"
        message={<>แผนการเดินทางนี้จะถูกลบถาวร และ LINE Bot จะได้รับแจ้งเตือนโดยอัตโนมัติ</>}
        confirmLabel={deleting ? 'กำลังลบ...' : 'ลบ'}
        onConfirm={() => { if (deleteConfirm) handleDelete(deleteConfirm) }}
        onCancel={() => setDeleteConfirm(null)}
      />

    </main>
  )
}
