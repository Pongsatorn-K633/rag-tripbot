'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { motion, animate, useMotionValue, useReducedMotion } from 'motion/react'
import { ArrowRight, ChevronLeft, ChevronRight, Heart } from 'lucide-react'
import { resolveCoverImage } from '@/lib/cover-image'
import { formatRanges } from '@/lib/availability'
import type { PlanTemplate } from '@/app/components/PlanCard'

/**
 * TripDeck — mobile swipeable card deck for the landing's Featured Trips.
 *
 * Motion ported from the Kimi CardStack build (GSAP → motion/react); the card is
 * styled after the dopamichi travel-card reference (white boarding-pass).
 * The shared PlanCard is untouched — /discover, /saved and LIFF keep it.
 *
 * IMPORTANT: `x` is an explicit motion value driven imperatively (drag → fling →
 * snap/exit → reset), and is deliberately NOT in the `animate` prop. Mixing drag
 * with a declarative `animate.x` makes the drag gesture take ownership of the
 * value, so the card gets stranded off-screen after a fling or stuck mid-drag.
 */

// Per-depth resting pose, front → back (Kimi's stack config).
const STACK = [
  { y: 0, scale: 1, opacity: 1, shadow: '0 20px 60px rgba(0,0,0,0.35)' },
  { y: 8, scale: 0.96, opacity: 0.55, shadow: '0 15px 45px rgba(0,0,0,0.28)' },
  { y: 16, scale: 0.92, opacity: 0.3, shadow: '0 10px 30px rgba(0,0,0,0.2)' },
  { y: 24, scale: 0.88, opacity: 0.15, shadow: '0 5px 15px rgba(0,0,0,0.12)' },
]
/**
 * Card geometry. The cover is 4:5, so its height depends on the card's width —
 * which means the card height must track the width too, otherwise a fixed height
 * leaves dead space under the content. Height = chrome + cover, where
 * cover = (cardWidth − horizontal padding) × 1.25.
 * Chrome assumes the fixed 3-line text block (tagline / แนะนำ / เปิดให้เที่ยว).
 */
const CARD_MAX_W = 300 // px — the only size dial; the 4:5 cover makes height follow
export const DECK_CARD_W = `min(${CARD_MAX_W}px, calc(100vw - 3rem))`
// 258 not 256: the cover's dot row moved OUT of the image (+10px: mt-1 + a 6px
// dot), offset by tightening the rule below it from mt-4 to mt-2 (−8px).
// Without tracking this the fixed-height card would clip its own barcode.
export const DECK_CARD_H = `calc(258px + (min(${CARD_MAX_W}px, 100vw - 3rem) - 40px) * 1.25)`

const TILT = [-1.5, 2, -2.5, 1.8] // per-card resting rotation (deg)
const SWIPE = 60 // fling threshold (px)
const EXIT_X = -400
const EXIT_MS = 420

// GSAP easing equivalents
const EASE_BACK_OUT = [0.34, 1.56, 0.64, 1] as const // back.out(1.4)
const EASE_IN_OUT = [0.45, 0, 0.55, 1] as const // power2.inOut
const EASE_IN = [0.11, 0, 0.5, 0] as const // power2.in
const EASE_OUT = [0.5, 1, 0.89, 1] as const // power2.out

/** EMV-style chip, drawn to match the reference card. `w`/`h` scale it for the
 *  compact card — the viewBox is fixed, so the drawing scales cleanly. */
function Chip({ w = 34, h = 26 }: { w?: number; h?: number }) {
  return (
    <svg width={w} height={h} viewBox="0 0 34 26" aria-hidden className="shrink-0">
      <rect x="0.5" y="0.5" width="33" height="25" rx="4" fill="#e4e4ea" stroke="#bfbfc9" />
      <rect x="10.5" y="5.5" width="13" height="15" rx="2" fill="none" stroke="#bfbfc9" />
      <path
        d="M0 9h10.5M0 17h10.5M34 9H23.5M34 17H23.5M17 0.5v5M17 20.5v5"
        stroke="#bfbfc9"
        strokeWidth="1"
      />
    </svg>
  )
}

/**
 * Lean for a trip whose admin hasn't picked one — every compact card tilts, so
 * a stack reads as scattered tickets. Derived from the trip id, NOT Math.random:
 * a real random would re-roll on every render, so cards would jump between
 * paints and the server and client HTML wouldn't match. Same trip, same lean.
 */
function defaultTilt(seed: string): 'left' | 'right' {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return (h & 1) === 0 ? 'left' : 'right'
}

/** Deterministic decorative barcode — same trip always gets the same pattern. */
function barcodeBars(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return Array.from({ length: 58 }, (_, i) => {
    h = (h * 1103515245 + 12345) & 0x7fffffff
    return { flex: 1 + (h % 3), on: i % 2 === 0 }
  })
}

/**
 * Cover gallery (Template.coverImages, max 5) — tap-only, deliberately.
 * The card itself is drag="x" to fling the deck, so a drag carousel here would
 * fight it for the same gesture; arrows keep the two inputs separate. Dots are
 * plain indicators — at this size they'd be a 6px tap target.
 */
function CoverCarousel({
  images,
  alt,
  places = [],
  square = false,
  compact = false,
  drag = true,
  onIndexChange,
}: {
  images: string[]
  alt: string
  /** Per-cover captions, keyed by index (V3 `overview.cover_places`). */
  places?: string[]
  /** Square crop for the compact card's thumb; default 4:5 as the tall card. */
  square?: boolean
  /** Compact card: smaller dots, no arrows (drag + dots carry the control). */
  compact?: boolean
  /** Drag-to-change. MUST be false inside the mobile deck, whose card owns the
   *  same horizontal gesture to fling — the two would fight for it. */
  drag?: boolean
  /** Report the visible cover so a card can caption it OUTSIDE the image (the
   *  compact card puts the place name in its header row instead of overlaying
   *  it). Pass no `places` in that case and nothing is drawn on the photo. */
  onIndexChange?: (i: number) => void
}) {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    onIndexChange?.(idx)
  }, [idx, onIndexChange])
  const dragFrom = useRef<number | null>(null)
  // Set when a pointer gesture actually travelled far enough to count as a
  // swipe, so the click it produces can be swallowed before it reaches the
  // card's onClick (which opens the trip).
  const swiped = useRef(false)
  const arrow = `absolute top-1/2 -translate-y-1/2 place-items-center rounded-full bg-briefing-cream/50 text-zen-black shadow-md transition-colors hover:bg-briefing-cream ${
    compact ? 'h-5 w-5' : 'h-7 w-7'
  }`
  // Display kept OUT of `arrow` so `hidden` and `grid` never fight over CSS
  // order. Compact: desktop only — on a phone the 126px thumb has no room and
  // drag + dots already cover it.
  const arrowShow = compact ? 'hidden md:grid' : 'grid'

  const step = (by: 1 | -1) => setIdx((i) => (i + by + images.length) % images.length)

  function go(e: React.MouseEvent, by: 1 | -1) {
    e.stopPropagation() // the card's own onClick opens the trip
    step(by)
  }

  const canDrag = drag && images.length > 1
  // Distance that counts as a swipe rather than a tap. Proportional to the
  // target: 40px is a third of the compact card's 126px thumb, so a normal
  // drag there fell short and read as "dragging doesn't work".
  const swipeMin = compact ? 22 : 40

  function onPointerDown(e: React.PointerEvent) {
    if (!canDrag) return
    // Never start a drag on the arrows. Capturing the pointer retargets the
    // release to this container, so the button's click event never fires —
    // which made the arrows dead and left dragging as the only control.
    if ((e.target as HTMLElement).closest('button')) return
    dragFrom.current = e.clientX
    swiped.current = false
    // Capture the pointer so pointerup still lands here even when the cursor
    // leaves the thumb mid-drag — easy on a 126px target, and without this the
    // gesture is silently dropped.
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  function onPointerUp(e: React.PointerEvent) {
    if (dragFrom.current === null) return
    const dx = e.clientX - dragFrom.current
    dragFrom.current = null
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    if (Math.abs(dx) < swipeMin) return // a tap, not a swipe — let the card open
    swiped.current = true
    step(dx < 0 ? 1 : -1)
  }

  // Capture phase: a swipe still fires a click on release, which would open the
  // trip. Kill that one click before it bubbles to the card.
  function onClickCapture(e: React.MouseEvent) {
    if (!swiped.current) return
    swiped.current = false
    e.stopPropagation()
    e.preventDefault()
  }

  return (
    // 4:5 — matches the cover pipeline (c_fill,g_auto,ar_4:5), so the delivered
    // image is shown whole with no second crop. The compact card squares it.
    // rounded-lg softens both cards' covers, clipped by the overflow-hidden.
    // relative: the caption is positioned against THIS wrapper, not the image
    // box below — see the comment on it.
    <div className="relative w-full">
      <div
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onClickCapture={onClickCapture}
        // Compact: the thumb is a gallery in its own right, so a click on it
        // must NOT fall through to the card and open the trip. Bubble phase,
        // not capture — the arrows sit inside and need their click first (they
        // stopPropagation themselves, so they never reach this).
        onClick={compact ? (e) => e.stopPropagation() : undefined}
        // select-none: without it a mouse drag starts selecting the page
        // instead of swiping. touch-pan-y keeps vertical scrolling native while
        // the horizontal axis is ours.
        className={`relative w-full overflow-hidden rounded-lg ${square ? 'aspect-square' : 'aspect-[4/5]'} ${
          canDrag ? 'cursor-grab touch-pan-y select-none active:cursor-grabbing' : ''
        }`}
      >
        {images.map((src, i) => (
          <Image
            key={i}
            src={src}
            alt={`${alt} ${i + 1}`}
            fill
            sizes={compact ? '126px' : '300px'}
            draggable={false}
            // decoding="sync": these covers are all in the DOM at opacity 0, so
            // they're fetched up front — but the browser defers DECODING what
            // isn't visible. On reveal it then paints the progressive passes,
            // which reads as the image resolving from low to high res. Forcing
            // a synchronous decode paints the finished image straight away.
            // (Only noticeable on the tall card: the compact one requests a
            // 126px variant that decodes too fast to see.)
            decoding="sync"
            // NO transform-gpu here: promoting these to their own layers made
            // the deck's scaled cards rasterize whole, softening image AND text
            // across the card. The caption is kept out of the crossfade by
            // living outside this box instead (below).
            className={`object-cover transition-opacity duration-300 ${
              i === idx ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ))}

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => go(e, -1)}
              aria-label="Previous cover"
              className={`${arrow} ${arrowShow} ${compact ? 'left-1' : 'left-2'}`}
            >
              <ChevronLeft size={compact ? 11 : 16} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={(e) => go(e, 1)}
              aria-label="Next cover"
              className={`${arrow} ${arrowShow} ${compact ? 'right-1' : 'right-2'}`}
            >
              <ChevronRight size={compact ? 11 : 16} strokeWidth={2.5} />
            </button>
          </>
        )}
      </div>

      {/* Caption for the CURRENT cover — makes flipping the gallery informative
          instead of showing anonymous photos. Absent for v1/v2 trips, which
          have no authored cover_places.
          It sits OUTSIDE the image box on purpose: as a sibling of the fading
          images it got rasterized into their compositing layer and "loaded"
          from blurry to sharp on every change. Positioned against the wrapper,
          it overlaps the cover visually but is never part of that layer.
          pointer-events-none so it can't swallow a tap or the start of a swipe. */}
      {places[idx] && (
        // key={idx}: each cover's caption is a FRESH element, so it plays the
        // opacity-only fade-in once, then settles as plain page paint — sharp.
        // NO will-change here: pinning the caption to a persistent layer made
        // it a cached texture, and inside the deck's scaled cards that texture
        // renders below device resolution — permanently soft text. A temporary
        // layer for the 300ms animation is fine: any softness hides inside the
        // fade itself, and the settled state is a normal crisp paint.
        <span
          key={idx}
          // Width cap so a long place name can't stretch the pill across the
          // whole cover; `truncate` handles the rest. Looser on the compact
          // card — 75% of its 126px thumb would cut almost every name.
          className={`pointer-events-none absolute right-2 top-2 z-10 truncate rounded-full bg-zen-black/55 font-headline font-bold tracking-wide text-briefing-cream animate-fade-in ${
            compact ? 'max-w-[85%] px-2 py-0.5 text-[10px]' : 'max-w-[75%] px-3 py-1 text-[12px]'
          }`}
        >
          {places[idx]}
        </span>
      )}

      {/* Dots BELOW the image, not over it — they no longer cover the photo or
          collide with the caption. Buttons on both cards: with the arrows gone
          from the compact one they're its only tap control, and on the tall
          card they're a useful shortcut beside the arrows.
          The gap above them is per-card (tighter on the compact one). Changing
          the TALL card's value means adjusting DECK_CARD_H by the same amount,
          or its pinned barcode clips. */}
      {images.length > 1 && (
        <div className={`flex justify-center gap-1 ${compact ? 'mt-1' : 'mt-2'}`}>
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Cover ${i + 1}`}
              onClick={(e) => {
                e.stopPropagation()
                setIdx(i)
              }}
              // px only — vertical padding is the space above/below the row.
              // Horizontal padding doubles up between neighbours, so it drives
              // the visible gap more than `gap-1` does. Tighter on the compact
              // card, where drag is the main control and the dots are mostly an
              // indicator; the tall card keeps the bigger tap target.
              className={`grid place-items-center ${compact ? 'px-0.5' : 'px-1'}`}
            >
              <span
                className={`block rounded-full transition-colors ${compact ? 'h-1 w-1' : 'h-1.5 w-1.5'} ${
                  i === idx ? 'bg-zen-black/70' : 'bg-zen-black/25'
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** The boarding-pass card face — shared by the mobile deck (DeckCard) and the
 *  desktop row (TripCard) so the design exists in exactly one place. Expects a
 *  flex-col parent with the DECK_CARD_H height (the barcode pins via mt-auto). */
function CardFace({
  tpl,
  saved,
  isPending,
  onHeart,
}: {
  tpl: PlanTemplate
  saved: boolean
  isPending: boolean
  onHeart: (id: string, e: React.MouseEvent) => void
}) {
  // Gallery when authored, else the primary cover alone (resolveCoverImage turns
  // a null into the deterministic per-trip fallback, as before).
  const covers = tpl.coverImages?.length ? tpl.coverImages : [tpl.coverImage]
  const images = covers.map((c) => resolveCoverImage(c, tpl.id))
  const bars = barcodeBars(tpl.id)
  const rec = tpl.availability?.recommended ?? []
  const avail = tpl.availability?.available ?? []

  return (
    <>
      {/* Day count + save */}
      <div className="flex items-center justify-between px-5 pt-4">
        <span className="font-headline text-[13px] font-medium tracking-[0.06em] text-zen-black">
          {tpl.totalDays} DAYS
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onHeart(tpl.id, e)
          }}
          disabled={isPending}
          aria-label={saved ? 'Unsave' : 'Save'}
          className="text-zen-black/70 transition-colors hover:text-red-500 disabled:opacity-60"
        >
          {/* Saved = red, the universal favourite convention (deliberate
              exception to the single-accent palette rule). */}
          <Heart size={18} strokeWidth={1.5} className={saved ? 'fill-red-500 text-red-500' : ''} />
        </button>
      </div>

      {/* Cover — pt matches the header's pt so the DAYS row sits centred in its band. */}
      <div className="px-5 pt-3.5">
        {/* drag={false}: this card keeps arrows + dots. On the mobile deck the
            card itself is drag="x" to fling the stack, so a draggable cover
            would fight it — and on desktop the arrows already do the job. */}
        <CoverCarousel images={images} alt={tpl.title} places={tpl.coverPlaces ?? []} drag={false} />
      </div>

      {/* Rule → PREVIEW | chip | title → Rule */}
      {/* mt-2, not mt-4: the cover's dot row now sits below the image, so this
          rule needs less of its own gap or the pair reads as a big empty band. */}
      <div className="mx-5 mt-2 border-t border-zen-black/80" />
      <div className="mx-5 flex items-stretch">
        <div className="flex flex-col items-center justify-center py-3 pr-3 font-headline text-[9px] font-bold uppercase leading-[1.5] tracking-[0.14em] text-basel-brick">
          Preview
          <ArrowRight className="mt-1 h-3 w-3" strokeWidth={2} />
        </div>
        <div className="flex items-center border-x border-zen-black/80 px-3">
          <Chip />
        </div>
        <div className="flex flex-1 items-center pl-3">
          <h3 className="line-clamp-2 font-headline text-[20px] font-extrabold uppercase leading-[0.95] tracking-[-0.02em] text-zen-black">
            {tpl.title}
          </h3>
        </div>
      </div>
      <div className="mx-5 border-t border-zen-black/80" />

      {/* Tagline + travel periods (carried over from the original PlanCard).
          leading-[23px] on every line, no space-y: an absolute line-height puts the
          mixed 13/11px sizes on one baseline grid (a ratio would give each a different
          half-leading, so the gaps read uneven). 23px also clears Thai's stacked marks,
          which a line-clamp box — exactly one line-height tall — would otherwise shave.
          Periods clamp by range count, never mid-date: a cut range reads as a wrong one. */}
      {/* min-h = 3 × leading-[23px]: the card's height budget assumes a full
          three-line block (tagline / แนะนำ / เปิดให้เที่ยว), but a trip missing one
          — e.g. no `available` window — would otherwise leave that line's slack
          for mt-auto to absorb, so its barcode and tear line sat at a different
          height than a full card's. Reserving the band keeps every card
          identical whatever the data. */}
      <div className="mx-5 mb-2.5 mt-3 min-h-[69px]">
        {tpl.description && (
          <p className="line-clamp-1 font-sans text-[13px] leading-[23px] text-zen-black/80">
            {tpl.description}
          </p>
        )}
        {rec.length > 0 && (
          <p className="line-clamp-1 text-[11px] font-bold leading-[23px] text-basel-brick">
            <span className="mr-1 tracking-widest text-basel-brick/75">แนะนำ</span>
            {formatRanges(rec.slice(0, 1), 'th')}
            {rec.length > 1 && (
              <span className="ml-1 font-medium text-basel-brick/70">+{rec.length - 1} ช่วง</span>
            )}
          </p>
        )}
        {avail.length > 0 && (
          <p className="line-clamp-1 text-[11px] leading-[23px] text-zen-black/70">
            <span className="mr-1 tracking-widest text-zen-black/50">เปิดตามฤดูกาล</span>
            {formatRanges(avail.slice(0, 1), 'th')}
            {avail.length > 1 && (
              <span className="ml-1 text-zen-black/50">+{avail.length - 1} ช่วง</span>
            )}
          </p>
        )}
      </div>

      {/* Perforation + decorative barcode — mt-auto pins the pair flush to the
          card's bottom edge. The dashed rule is the tear line of the boarding
          pass (the compact card carries the same cue down its stub's edge). */}
      {/* The tear line runs edge to edge (no mx-5, unlike the rules above) —
          a perforation crosses the whole ticket. The barcode stays inset. */}
      <div className="mt-auto border-t border-dashed border-zen-black/25 pt-3.5">
        <div className="mx-5 flex h-9 items-stretch overflow-hidden">
          {bars.map((b, bi) => (
            <span key={bi} style={{ flex: b.flex }} className={b.on ? 'bg-zen-black' : 'bg-transparent'} />
          ))}
        </div>
      </div>
    </>
  )
}

/**
 * Desktop coverflow — the front card centred with the rest fanned to its left
 * and right in 3D, receding, fading and blurring with distance. Wraps around
 * (the last card sits to the left of the first), so it reads as a ring rather
 * than a queue.
 *
 * Desktop only; the phone keeps `TripDeck`'s vertical stack, which doesn't need
 * the horizontal room this design assumes.
 */
// Pose by distance from centre. `x` is a MULTIPLE of card width so the fan
// scales with the card. rotateY is signed per side so the cards face inward.
const FLOW_POSES = [
  { x: 0, scale: 1, rotateY: 0, opacity: 1, blur: 0 },
  { x: 1.18, scale: 0.88, rotateY: 20, opacity: 0.95, blur: 0.8 },
  { x: 2.12, scale: 0.76, rotateY: 28, opacity: 0.55, blur: 2.5 },
]
const FLOW_VISIBLE = FLOW_POSES.length - 1 // how far from centre still renders
const FLOW_DRAG = 60 // px before a drag counts as advancing

export function TripCoverflow({
  templates,
  savedIds,
  pending,
  onOpen,
  onHeart,
}: {
  templates: PlanTemplate[]
  savedIds: Set<string>
  pending: Set<string>
  onOpen: (id: string) => void
  onHeart: (id: string, e: React.MouseEvent) => void
}) {
  const [active, setActive] = useState(0)
  const reduced = useReducedMotion() ?? false
  const dragFrom = useRef<number | null>(null)
  const dragged = useRef(false)
  const n = templates.length

  /** Shortest signed distance from the active card, wrapping around the ring. */
  function offsetOf(i: number) {
    let off = i - active
    if (off > n / 2) off -= n
    if (off < -n / 2) off += n
    return off
  }

  const move = (by: 1 | -1) => setActive((a) => (a + by + n) % n)

  // Deliberately NO setPointerCapture here (unlike the cover carousel): capture
  // retargets the release to this container, so the click never reaches the
  // card — which killed opening the centre trip, the heart and the cover
  // arrows. The fan is wide enough that a release outside it is rare, and
  // onPointerLeave cancels that case.
  function onPointerDown(e: React.PointerEvent) {
    dragFrom.current = e.clientX
    dragged.current = false
  }

  function onPointerUp(e: React.PointerEvent) {
    if (dragFrom.current === null) return
    const dx = e.clientX - dragFrom.current
    dragFrom.current = null
    if (Math.abs(dx) < FLOW_DRAG) return // a tap — let the card's onClick run
    dragged.current = true // swallow the click this release produces
    move(dx < 0 ? 1 : -1)
  }

  return (
    <div className="select-none">
      <div
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          dragFrom.current = null // released outside the fan — cancel, don't advance
        }}
        onClickCapture={(e) => {
          if (!dragged.current) return
          dragged.current = false
          e.stopPropagation()
        }}
        // perspective makes rotateY read as depth rather than a squash;
        // overflow-hidden keeps the far cards from widening the page.
        // The extra 72px of height is room for the cards' drop shadow to fade
        // out INSIDE the box — at exactly card height, overflow-hidden sliced
        // the shadow mid-fade and left a hard-edged band under each card.
        // Full-bleed: left-1/2 + w-screen + -translate-x-1/2 breaks out of the
        // page's 1536px wrapper. Without it the fan (~1600px) was sliced by the
        // wrapper's edge, which read as an invisible border cutting the outer
        // cards mid-page. Now they run off the SCREEN edge instead.
        className="relative left-1/2 w-screen -translate-x-1/2 cursor-grab overflow-hidden active:cursor-grabbing"
        style={{ height: `calc(${DECK_CARD_H} + 72px)`, perspective: 1800 }}
      >
        {templates.map((tpl, i) => {
          const off = offsetOf(i)
          const dist = Math.abs(off)
          if (dist > FLOW_VISIBLE) return null
          const pose = FLOW_POSES[dist]
          const dir = Math.sign(off)
          const isCentre = off === 0
          return (
            <motion.div
              key={tpl.id}
              initial={false}
              // Plain numbers, not a calc() string: Motion interpolates px
              // cleanly, and `calc(-50% + -0.66 * …)` isn't even valid CSS.
              // Desktop-only, so the card is always CARD_MAX_W wide; the
              // -50% centring is done statically by marginLeft below.
              animate={{
                x: dir * pose.x * CARD_MAX_W,
                scale: pose.scale,
                // NEGATED dir: the cards must face INWARD, toward the centre.
                // dir * angle turned each one away from the middle (left cards
                // looking further left, right cards further right), which read
                // as the fan opening outwards instead of wrapping around.
                rotateY: reduced ? 0 : -dir * pose.rotateY,
                opacity: pose.opacity,
                filter: reduced || !pose.blur ? 'blur(0px)' : `blur(${pose.blur}px)`,
              }}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
              style={{
                width: CARD_MAX_W,
                height: DECK_CARD_H,
                zIndex: 10 - dist,
                left: '50%',
                marginLeft: -CARD_MAX_W / 2,
              }}
              onClick={() => (isCentre ? onOpen(tpl.id) : setActive(i))}
              className={`absolute top-0 flex flex-col overflow-hidden rounded-[20px] bg-briefing-cream shadow-[0_20px_60px_rgba(0,0,0,0.35)] ${
                isCentre ? 'cursor-pointer' : 'cursor-pointer'
              }`}
            >
              <CardFace
                tpl={tpl}
                saved={savedIds.has(tpl.id)}
                isPending={pending.has(tpl.id)}
                onHeart={onHeart}
              />
            </motion.div>
          )
        })}
      </div>

      {/* Position dots — the active one stretches, matching the deck's. */}
      {n > 1 && (
        <div className="mt-4 flex justify-center gap-1.5">
          {templates.map((tpl, i) => (
            <button
              key={tpl.id}
              type="button"
              aria-label={`Trip ${i + 1}`}
              onClick={() => setActive(i)}
              className="p-1"
            >
              <span
                className={`block h-1.5 rounded-full transition-all ${
                  i === active ? 'w-5 bg-briefing-cream' : 'w-1.5 bg-briefing-cream/30'
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Static desktop card — the same face with a hover lift instead of the deck. */
export function TripCard({
  tpl,
  saved,
  isPending,
  onOpen,
  onHeart,
}: {
  tpl: PlanTemplate
  saved: boolean
  isPending: boolean
  onOpen: (id: string) => void
  onHeart: (id: string, e: React.MouseEvent) => void
}) {
  return (
    <div
      onClick={() => onOpen(tpl.id)}
      style={{ width: DECK_CARD_W, height: DECK_CARD_H }}
      className="flex cursor-pointer flex-col overflow-hidden rounded-[20px] bg-briefing-cream shadow-[0_20px_60px_rgba(0,0,0,0.35)] transition-[transform,box-shadow] duration-300 hover:-translate-y-2 hover:shadow-[0_28px_70px_rgba(0,0,0,0.45)]"
    >
      <CardFace tpl={tpl} saved={saved} isPending={isPending} onHeart={onHeart} />
    </div>
  )
}

/**
 * Compact HORIZONTAL card — the same boarding pass turned on its side: square
 * cover left, the full information column centre, barcode as a perforated stub
 * down the right edge. Carries every element of `CardFace` (day count, heart,
 * cover carousel, PREVIEW | chip | title triptych, tagline, both period lines,
 * barcode) at a smaller type scale.
 *
 * A separate component rather than a `variant` on CardFace: the vertical and
 * horizontal arrangements diverge enough that conditionals would tangle both.
 */
export function TripCardCompact({
  tpl,
  saved,
  isPending,
  onOpen,
  onHeart,
}: {
  tpl: PlanTemplate
  saved: boolean
  isPending: boolean
  onOpen: (id: string) => void
  onHeart: (id: string, e: React.MouseEvent) => void
}) {
  const covers = tpl.coverImages?.length ? tpl.coverImages : [tpl.coverImage]
  const images = covers.map((c) => resolveCoverImage(c, tpl.id))
  const bars = barcodeBars(tpl.id)
  const rec = tpl.availability?.recommended ?? []
  const avail = tpl.availability?.available ?? []
  // The visible cover, reported up by the carousel: this card captions the
  // photo in its header row rather than overlaying the image.
  const [coverIdx, setCoverIdx] = useState(0)
  const place = tpl.coverPlaces?.[coverIdx]
  // Admin's pick when they've made one (including an explicit 'none'); every
  // other trip leans one way or the other rather than sitting straight.
  const tilt =
    tpl.cardTilt === 'none' || tpl.cardTilt === 'left' || tpl.cardTilt === 'right'
      ? tpl.cardTilt
      : defaultTilt(tpl.id)

  // formatRanges lists every window, joined with " / ". Labels carry no colour
  // of their own so they read at the same weight as their dates.
  const periods = (
    <>
      {rec.length > 0 && (
        <p className="text-[10px] font-bold leading-[18px] text-basel-brick">
          <span className="mr-1 tracking-widest text-basel-brick/75">แนะนำ</span>
          {formatRanges(rec, 'th')}
        </p>
      )}
      {/* Availability + day count share this line, count flush right. A trip
          with no window isn't season-bound at all, so it says so rather than
          showing an empty "เปิดตามฤดูกาล". */}
      <div className="flex items-baseline justify-between gap-2">
        <p className="min-w-0 text-[10px] leading-[18px] text-zen-black">
          {avail.length > 0 ? (
            <>
              <span className="mr-1 tracking-widest">เปิดตามฤดูกาล</span>
              {formatRanges(avail, 'th')}
            </>
          ) : (
            <span className="tracking-widest">เที่ยวได้ทั้งปี</span>
          )}
        </p>
        <span className="shrink-0 font-headline text-[10px] font-medium tracking-[0.06em] text-zen-black">
          {tpl.totalDays} DAYS
        </span>
      </div>
    </>
  )

  return (
    <div
      onClick={() => onOpen(tpl.id)}
      // max-w-md (448px) not 3xl (768px): at full width the row stretched, all
      // the content bunched left and the right half sat empty. Mobile is
      // unaffected — below 448px this is simply w-full.
      // The tilt is a Tailwind rotate utility so it COMPOSES with the hover
      // translate (both write the same transform variables) — a raw
      // `transform` in style would clobber the lift instead.
      className={`flex w-full max-w-md cursor-pointer overflow-hidden rounded-xl bg-briefing-cream shadow-[0_10px_30px_rgba(0,0,0,0.28)] transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:rotate-0 hover:shadow-[0_16px_40px_rgba(0,0,0,0.38)] ${
        tilt === 'left' ? '-rotate-[1.2deg]' : tilt === 'right' ? 'rotate-[1.2deg]' : ''
      }`}
    >
      {/* Left group — a column: [cover | title block] on top, then the travel
          periods as a band spanning both. The periods get the card's full width
          that way, instead of being squeezed into the narrow text column (on a
          phone that column is ~165px, which orphaned the "+N ช่วง" suffix). */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0">
          {/* Square cover — 150px box − p-3 = a 126px square.
              pb-1: the dot row sits under the image, so the box needs almost no
              bottom padding of its own. */}
          <div className="w-[150px] shrink-0 px-3 pb-1 pt-3">
            {/* No `places` — the caption is NOT drawn on the photo here; the
                header row shows it instead, driven by onIndexChange. */}
            <CoverCarousel images={images} alt={tpl.title} square compact onIndexChange={setCoverIdx} />
          </div>

          {/* min-w-0: without it this flex child refuses to shrink and the text
              below stops wrapping inside the column. */}
          <div className="flex min-w-0 flex-1 flex-col py-3 pr-3">
        {/* Cover caption (left) · day count + save (right). The caption lives
            here rather than over the photo — off the image it's plain page
            paint, so it can never be dragged into the crossfade's layer.
            key={coverIdx} replays the opacity fade on each cover change. */}
        <div className="flex items-center justify-between gap-2">
          {place ? (
            <span
              key={coverIdx}
              className="flex min-w-0 max-w-[85%] animate-fade-in items-center gap-1 font-headline text-[11px] font-medium tracking-[0.06em] text-graphite"
            >
              <ArrowRight className="size-3 shrink-0" strokeWidth={2} aria-hidden />
              <span className="truncate">{place}</span>
            </span>
          ) : (
            <span /> /* keeps the heart right-aligned when a trip has no places */
          )}
          {/* The day count moved down to the availability line; this row is
              just the cover caption and the save button now. */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onHeart(tpl.id, e)
            }}
            disabled={isPending}
            aria-label={saved ? 'Unsave' : 'Save'}
            className="shrink-0 text-zen-black/70 transition-colors hover:text-red-500 disabled:opacity-60"
          >
            {/* Saved = red, the universal favourite convention (deliberate
                exception to the single-accent palette rule). */}
            <Heart size={16} strokeWidth={1.5} className={saved ? 'fill-red-500 text-red-500' : ''} />
          </button>
        </div>

        {/* Rule → title → Rule. No PREVIEW cue or chip glyph here (the tall
            card keeps both): at this size they crowded the title, and the whole
            card is already a click target. */}
        <div className="mt-2 border-t border-zen-black/80" />
        <h3 className="py-2 font-headline text-[15px] font-extrabold uppercase leading-[1.1] tracking-[-0.02em] text-zen-black">
          {tpl.title}
        </h3>
        <div className="border-t border-zen-black/80" />

            {/* Tagline. leading-[18px] absolute, not a ratio: mixed 12/10px
                sizes on a ratio get different half-leading so the gaps read
                uneven, and 18px clears Thai's stacked marks. */}
            {tpl.description && (
              <p className="mt-1.5 font-sans text-[12px] leading-[18px] text-zen-black/80">
                {tpl.description}
              </p>
            )}
          </div>
        </div>

        {/* Travel periods + day count — a band across the full card width
            (cover + text), so the dates keep to one line each. Always rendered:
            a trip with no windows still says เที่ยวได้ทั้งปี and carries the day
            count. mt-auto pins it to the bottom when the cover is taller. */}
        <div className="mt-auto border-t border-zen-black/15 px-3 py-2">{periods}</div>
      </div>

      {/* Barcode as the ticket stub — the same deterministic pattern, stacked
          into a vertical strip behind a perforation. */}
      {/* pl only, no pr: the bars run flush to the card's right edge, the way
          the tall card's tear line runs edge to edge. */}
      <div className="flex w-7 shrink-0 flex-col items-stretch overflow-hidden border-l border-dashed border-zen-black/25 py-3 pl-2">
        {bars.map((b, bi) => (
          <span key={bi} style={{ flex: b.flex }} className={b.on ? 'bg-zen-black' : 'bg-transparent'} />
        ))}
      </div>
    </div>
  )
}

function DeckCard({
  tpl,
  pos,
  tilt,
  isExiting,
  locked,
  saved,
  isPending,
  reduced,
  canSwipe,
  onOpen,
  onHeart,
  onNext,
  onPrev,
}: {
  tpl: PlanTemplate
  pos: number
  tilt: number
  isExiting: boolean
  locked: boolean
  saved: boolean
  isPending: boolean
  reduced: boolean
  /** false when the deck has a single card — nowhere to swipe to. */
  canSwipe: boolean
  onOpen: (id: string) => void
  onHeart: (id: string, e: React.MouseEvent) => void
  onNext: () => void
  onPrev: () => void
}) {
  const x = useMotionValue(0)
  const dragged = useRef(false)
  const isFront = pos === 0
  // A single-card deck has nowhere to swipe TO — disable drag entirely
  // (next()/prev() already no-op, but the card shouldn't even wiggle).
  const pose = STACK[Math.min(Math.max(pos, 0), STACK.length - 1)]

  // Whenever the card settles back into the stack (notably right after its exit
  // animation, once the order has rotated), snap x home instantly — mirrors the
  // gsap.set() reset in the original. The back cards are near-invisible, so the
  // jump isn't perceptible.
  useEffect(() => {
    if (!isExiting) x.set(0)
  }, [isExiting, pos, x])

  return (
    <motion.div
      drag={isFront && canSwipe && !isExiting && !locked && !reduced ? 'x' : false}
      dragElastic={0.7}
      dragMomentum={false}
      style={{ x, height: DECK_CARD_H, zIndex: 40 - pos * 10, boxShadow: pose.shadow }}
      animate={{
        y: pose.y,
        opacity: isExiting ? 0 : pose.opacity,
        scale: isExiting ? 0.85 : pose.scale,
        rotate: isExiting ? -10 : tilt,
      }}
      transition={
        reduced
          ? { duration: 0 }
          : {
              duration: isExiting ? EXIT_MS / 1000 : 0.5,
              ease: isExiting ? EASE_IN : isFront ? EASE_BACK_OUT : EASE_IN_OUT,
            }
      }
      onPointerDown={() => {
        dragged.current = false
      }}
      onDragStart={() => {
        dragged.current = true
      }}
      onDragEnd={(_, info) => {
        if (info.offset.x < -SWIPE) {
          animate(x, EXIT_X, { duration: EXIT_MS / 1000, ease: EASE_IN })
          onNext()
        } else {
          // Right fling advances backwards; either way this card returns home.
          animate(x, 0, { duration: 0.3, ease: EASE_OUT })
          if (info.offset.x > SWIPE) onPrev()
        }
      }}
      onClick={() => {
        if (!dragged.current) onOpen(tpl.id)
      }}
      className={`absolute left-0 top-0 flex w-full flex-col overflow-hidden rounded-[20px] bg-briefing-cream ${
        isFront && !isExiting ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'
      }`}
    >
      <CardFace tpl={tpl} saved={saved} isPending={isPending} onHeart={onHeart} />
    </motion.div>
  )
}

export default function TripDeck({
  templates,
  savedIds,
  pending,
  onOpen,
  onHeart,
}: {
  templates: PlanTemplate[]
  savedIds: Set<string>
  pending: Set<string>
  onOpen: (id: string) => void
  onHeart: (id: string, e: React.MouseEvent) => void
}) {
  const reduced = useReducedMotion() ?? false
  const [order, setOrder] = useState<number[]>(() => templates.map((_, i) => i))
  const [exiting, setExiting] = useState<number | null>(null)
  const [locked, setLocked] = useState(false) // blocks drag during a transition
  const busy = useRef(false)
  const timer = useRef<number | null>(null)

  // The stack order is seeded once on mount; the parent remounts via `key` when
  // the trip set changes. Just make sure a pending timer never outlives us.
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])

  /** Front card flies out left, then restacks to the back. */
  function next() {
    if (busy.current || templates.length < 2) return
    busy.current = true
    setLocked(true)
    setExiting(order[0])
    timer.current = window.setTimeout(() => {
      setOrder((o) => [...o.slice(1), o[0]])
      setExiting(null)
      setLocked(false)
      busy.current = false
    }, EXIT_MS)
  }

  /** Back card returns to the front. */
  function prev() {
    if (busy.current || templates.length < 2) return
    busy.current = true
    setLocked(true)
    setOrder((o) => [o[o.length - 1], ...o.slice(0, -1)])
    timer.current = window.setTimeout(() => {
      setLocked(false)
      busy.current = false
    }, EXIT_MS)
  }

  if (templates.length === 0) return null

  return (
    <div className="relative mx-auto select-none pb-10" style={{ width: DECK_CARD_W }}>
      <div className="relative" style={{ height: DECK_CARD_H }}>
        {templates.map((tpl, i) => {
          const pos = order.indexOf(i)
          if (pos < 0) return null // defensive: never render an unordered card
          return (
            <DeckCard
              key={tpl.id}
              tpl={tpl}
              pos={pos}
              tilt={TILT[i % TILT.length]}
              isExiting={exiting === i}
              locked={locked}
              saved={savedIds.has(tpl.id)}
              isPending={pending.has(tpl.id)}
              reduced={reduced}
              canSwipe={templates.length > 1}
              onOpen={onOpen}
              onHeart={onHeart}
              onNext={next}
              onPrev={prev}
            />
          )
        })}
      </div>

      {/* Position dots */}
      {templates.length > 1 && (
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
          {templates.map((tpl, i) => (
            <span
              key={tpl.id}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                order[0] === i ? 'w-5 bg-briefing-cream' : 'w-1.5 bg-briefing-cream/30'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
