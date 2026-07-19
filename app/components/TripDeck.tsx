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
export const DECK_CARD_H = `calc(256px + (min(${CARD_MAX_W}px, 100vw - 3rem) - 40px) * 1.25)`

const TILT = [-1.5, 2, -2.5, 1.8] // per-card resting rotation (deg)
const SWIPE = 60 // fling threshold (px)
const EXIT_X = -400
const EXIT_MS = 420

// GSAP easing equivalents
const EASE_BACK_OUT = [0.34, 1.56, 0.64, 1] as const // back.out(1.4)
const EASE_IN_OUT = [0.45, 0, 0.55, 1] as const // power2.inOut
const EASE_IN = [0.11, 0, 0.5, 0] as const // power2.in
const EASE_OUT = [0.5, 1, 0.89, 1] as const // power2.out

/** EMV-style chip, drawn to match the reference card. */
function Chip() {
  return (
    <svg width="34" height="26" viewBox="0 0 34 26" aria-hidden className="shrink-0">
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
function CoverCarousel({ images, alt }: { images: string[]; alt: string }) {
  const [idx, setIdx] = useState(0)
  const reduced = useReducedMotion() ?? false
  // Auto-advance every 4s. `idx` in the deps restarts the timer after ANY
  // change — so a manual arrow tap resets the clock instead of an auto-swipe
  // landing right on top of it. Off under prefers-reduced-motion.
  useEffect(() => {
    if (images.length < 2 || reduced) return
    const id = window.setInterval(() => setIdx((i) => (i + 1) % images.length), 4000)
    return () => window.clearInterval(id)
  }, [images.length, idx, reduced])
  const arrow =
    'absolute top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-briefing-cream/50 text-zen-black shadow-md transition-colors hover:bg-briefing-cream'

  function go(e: React.MouseEvent, step: 1 | -1) {
    e.stopPropagation() // the card's own onClick opens the trip
    setIdx((i) => (i + step + images.length) % images.length)
  }

  return (
    // 4:5 — matches the cover pipeline (c_fill,g_auto,ar_4:5), so the delivered
    // image is shown whole with no second crop.
    <div className="relative aspect-[4/5] w-full overflow-hidden">
      {images.map((src, i) => (
        <Image
          key={i}
          src={src}
          alt={`${alt} ${i + 1}`}
          fill
          sizes="300px"
          draggable={false}
          className={`object-cover transition-opacity duration-300 ${i === idx ? 'opacity-100' : 'opacity-0'}`}
        />
      ))}

      {images.length > 1 && (
        <>
          <button type="button" onClick={(e) => go(e, -1)} aria-label="Previous cover" className={`${arrow} left-2`}>
            <ChevronLeft size={16} strokeWidth={2.5} />
          </button>
          <button type="button" onClick={(e) => go(e, 1)} aria-label="Next cover" className={`${arrow} right-2`}>
            <ChevronRight size={16} strokeWidth={2.5} />
          </button>
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
            {images.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full shadow transition-colors ${
                  i === idx ? 'bg-briefing-cream' : 'bg-briefing-cream/50'
                }`}
              />
            ))}
          </div>
        </>
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
        <CoverCarousel images={images} alt={tpl.title} />
      </div>

      {/* Rule → PREVIEW | chip | title → Rule */}
      <div className="mx-5 mt-4 border-t border-zen-black/80" />
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
      <div className="mx-5 mb-3 mt-3">
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
            <span className="mr-1 tracking-widest text-zen-black/50">เปิดให้เที่ยว</span>
            {formatRanges(avail.slice(0, 1), 'th')}
            {avail.length > 1 && (
              <span className="ml-1 text-zen-black/50">+{avail.length - 1} ช่วง</span>
            )}
          </p>
        )}
      </div>

      {/* Decorative barcode — mt-auto pins it flush to the card's bottom edge */}
      <div className="mx-5 mt-auto flex h-9 items-stretch overflow-hidden">
        {bars.map((b, bi) => (
          <span key={bi} style={{ flex: b.flex }} className={b.on ? 'bg-zen-black' : 'bg-transparent'} />
        ))}
      </div>
    </>
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
