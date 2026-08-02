'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
// STATIC import, not the IMG string path: it gives next/image the intrinsic
// size AND an automatic inline blurDataURL, so the hero paints instantly as a
// blurred preview in the initial HTML instead of a blank block.
import heroImg from '@/public/japan-hero.jpg'
import { motion, useScroll, useTransform, useReducedMotion, type MotionValue } from 'motion/react'
import { Compass, Ticket } from 'lucide-react'
import { IMG } from '@/lib/images'
import { smoothScrollTo } from '@/lib/smooth-scroll'
import TripSearchSection from '@/app/components/TripSearchSection'
import JapanIcon from '@/app/components/JapanIcon'

// ── JAPAN scroll-dissolve ────────────────────────────────────────────────────
// Each letter scatters horizontally, rotates, drifts up, blurs and fades as you
// scroll through the hero — staggered per letter. Tuning ported from the Kimi build.
const HERO_LETTERS = [
  { char: 'J', rot: -6, xScatter: -80, stagger: 0, drift: 1 },
  { char: 'A', rot: 5, xScatter: 60, stagger: 0.015, drift: 1.3 },
  { char: 'P', rot: -4, xScatter: -50, stagger: 0.03, drift: 0.9 },
  { char: 'A', rot: 7, xScatter: 70, stagger: 0.01, drift: 1.1 },
  { char: 'N', rot: -5, xScatter: -65, stagger: 0.025, drift: 1.2 },
] as const

function HeroLetter({
  char, rot, xScatter, stagger, drift, progress, reduced,
}: {
  char: string; rot: number; xScatter: number; stagger: number; drift: number
  progress: MotionValue<number>; reduced: boolean
}) {
  const start = 0.15 + stagger
  const end = 0.45 + stagger
  // Transform + opacity ONLY — both composited, so scrolling repaints
  // nothing after the first raster. The scroll-linked blur() this used to
  // have was the lag: every radius change re-rasterized five ~350px glyph
  // layers (plus their text-shadow extents); quantizing helped but still
  // stuttered on weaker GPUs, and with the letters fading to 0 anyway the
  // blur read as marginal. Killed the whole channel (user call).
  const opacity = useTransform(progress, [0, start, end], reduced ? [0.94, 0.94, 0.94] : [0.94, 0.94, 0])
  const y = useTransform(progress, [0, start, end], reduced ? ['0%', '0%', '0%'] : ['0%', `${-20 * drift}%`, `${-85 * drift}%`])
  const x = useTransform(progress, [0, start, end], reduced ? [0, 0, 0] : [0, 0.25 * xScatter, xScatter])
  const rotate = useTransform(progress, [0, start, end], reduced ? [0, 0, 0] : [0, 0.4 * rot, rot])
  return (
    <motion.span className="inline-block will-change-transform" style={{ opacity, y, x, rotate }}>
      {char}
    </motion.span>
  )
}

// How far PAST the Featured Trips top edge the hero cues land. Bump this to sink
// the landing lower into the section; 0 puts the section's top at the viewport top.
const PATHWAYS_OFFSET = 30

/** Statement block with the edge0-style per-word scroll reveal, running as
 *  ONE continuous wave through the headline AND the body: each word slice
 *  transitions muted slate → Ocean (the "reading edge") → settled bright, in
 *  reading order, scrubbed by scroll (backwards on scroll-up). Ocean, not the
 *  reference's orange: the palette has one accent. Thai has no spaces, so
 *  both texts are PRE-CHUNKED at natural word boundaries and rendered as
 *  adjacent spans (which also become the only wrap points — fine here). */
const HEAD_CHUNKS = ['หมดปัญหา', 'เรื่อง', 'การจัดทริป', 'ที่ยุ่งยาก!'] as const
// Body is TWO authored lines (explicit break — user call); chunked per line.
const BODY_LINE1 = [
  'เรา', 'คัดสรร', 'สถานที่ฮิต ', 'ร้านอาหารเด็ด ', 'และ', 'จัดตาราง', 'การเดินทาง',
  'ไว้ให้คุณ', 'อย่างลงตัว', 'ในแต่ละวัน', ' ไม่ต้องเสียเวลา', 'หาข้อมูลเอง'
] as const
const BODY_LINE2 = [
  'เลือก', 'ทริปที่ใช่', 'และแพ็คกระเป๋า', 'เดินทาง', 'ได้ทันที',
] as const

/** Per-chunk [start, end] slices by CHARACTER position within the line — the
 *  reveal edge sits at the same horizontal fraction on every line, so all
 *  three lines sweep left→right TOGETHER (user call; the first cut revealed
 *  in reading order, line after line). */
function lineSlices(chunks: readonly string[]): [number, number][] {
  const total = chunks.reduce((n, c) => n + c.length, 0)
  let acc = 0
  return chunks.map((c) => {
    const s = acc / total
    acc += c.length
    return [s, acc / total]
  })
}
const HEAD_SLICES = lineSlices(HEAD_CHUNKS)
// The BODY is one continuous sequence across its two lines (the edge flows
// through line 1 then line 2) — sliced over the COMBINED text, it runs ~2×
// the per-line speed and finishes exactly when the headline does (user call).
const BODY_SLICES = lineSlices([...BODY_LINE1, ...BODY_LINE2])
const BODY1_SLICES = BODY_SLICES.slice(0, BODY_LINE1.length)
const BODY2_SLICES = BODY_SLICES.slice(BODY_LINE1.length)

function RevealChunk({
  progress, start, end, colors, children,
}: {
  progress: MotionValue<number>
  start: number
  end: number
  /** [unread, reading edge, settled] */
  colors: [string, string, string]
  children: React.ReactNode
}) {
  const color = useTransform(progress, [start, (start + end) / 2, end], colors)
  return <motion.span style={{ color }}>{children}</motion.span>
}

function ScrollRevealStatement() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.9', 'start 0.25'] })
  const headColors: [string, string, string] = ['#74879D', '#5B88B2', '#F7F9FC']
  // Body settles DIMMER than the headline (hierarchy holds even fully read);
  // its unread state is darker still.
  const bodyColors: [string, string, string] = ['#5C7089', '#5B88B2', '#C9D4E0']
  const line = (chunks: readonly string[], slices: [number, number][], colors: [string, string, string]) =>
    chunks.map((c, i) => (
      <RevealChunk key={i} progress={scrollYProgress} start={slices[i][0]} end={slices[i][1]} colors={colors}>
        {c}
      </RevealChunk>
    ))
  return (
    <div ref={ref}>
      {/* leading 1.3: Thai stacked vowels/tone marks clip on tight display
          leading. No max-w cap — the headline runs the content width. */}
      <h2 className="mt-5 font-headline text-4xl font-extrabold leading-[1.3] md:text-6xl">
        {line(HEAD_CHUNKS, HEAD_SLICES, headColors)}
      </h2>
      <p className="mt-5 font-sans text-base leading-relaxed md:text-lg">
        {line(BODY_LINE1, BODY1_SLICES, bodyColors)}
        <br />
        {line(BODY_LINE2, BODY2_SLICES, bodyColors)}
      </p>
    </div>
  )
}

export default function Home() {
  // Drives the blur→sharp "focus in" once the hero photo has decoded — the
  // default placeholder swap is an instant cut, not a transition.
  const [heroLoaded, setHeroLoaded] = useState(false)

  const scrollToPathways = (e?: { preventDefault: () => void }) => {
    e?.preventDefault()
    smoothScrollTo('pathways', 1200, PATHWAYS_OFFSET)
  }

  // Scroll-linked hero animation — tied to the hero section's own scroll progress,
  // fully disabled under prefers-reduced-motion.
  const heroRef = useRef<HTMLElement>(null)
  const reduced = useReducedMotion() ?? false
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  // Fade starts at the FIRST pixel of scroll (no 0.2 hold) — held opacity while
  // y/scale already move reads as "slides away without fading".
  const btnOpacity = useTransform(scrollYProgress, [0, 0.2], reduced ? [1, 1] : [1, 0])
  const btnY = useTransform(scrollYProgress, [0, 0.2, 0.45], reduced ? ['0%', '0%', '0%'] : ['0%', '-40%', '-120%'])
  const btnScale = useTransform(scrollYProgress, [0, 0.2, 0.45], reduced ? [1, 1, 1] : [1, 0.92, 0.75])

  return (
    <main className="bg-graphite">
      {/* Full-bleed photo hero */}
      <section ref={heroRef} className="relative w-full h-screen min-h-[660px] overflow-hidden bg-zen-black">
        <Image
          src={heroImg}
          alt="Mt. Fuji rising behind a Lawson convenience store at dusk"
          fill
          priority
          placeholder="blur"
          onLoad={() => setHeroLoaded(true)}
          // Starts soft-focused and a touch zoomed (the zoom hides the blur's
          // translucent edge halo), then eases to sharp once decoded — a
          // smooth focus-in instead of the placeholder's hard swap.
          className={`object-cover object-[60%_42%] md:object-[center_42%] z-0 transition-[filter,transform] duration-700 ease-out ${
            heroLoaded ? 'blur-0 scale-100' : 'blur-md scale-105'
          }`}
          sizes="100vw"
        />

        {/* Cool Midnight legibility overlay (top→bottom), on-palette with the blue scheme */}
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, rgba(18,44,79,0.55) 0%, rgba(18,44,79,0.2) 42%, rgba(18,44,79,0.5) 100%)',
          }}
        />

        {/* Bottom fade — dissolves the photo into the dark section below so there's
            no seam. Ends on EXACTLY #0A1B33, the top color of the next section. */}
        <div
          className="absolute inset-x-0 bottom-0 z-10 h-[18%] pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, rgba(10,27,51,0) 0%, rgba(10,27,51,0.25) 50%, rgba(10,27,51,0.8) 82%, #0A1B33 100%)',
          }}
        />

        {/* Center content: giant JAPAN wordmark + Start Journey */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="absolute inset-0 z-[15] flex flex-col items-center justify-center px-6 pointer-events-none"
        >
          <h1
            className="m-0 font-headline font-extrabold text-white text-center select-none text-[clamp(96px,25vw,350px)] leading-[0.9] tracking-[-0.03em]"
            style={{
              WebkitTextStroke: '1.4px rgba(255,255,255,0.5)',
              textShadow: '0 0 36px rgba(255,255,255,0.18), 0 6px 48px rgba(0,0,0,0.28)',
              transform: 'translateY(-10%)',
            }}
          >
            {HERO_LETTERS.map((l, i) => (
              <HeroLetter key={i} {...l} progress={scrollYProgress} reduced={reduced} />
            ))}
          </h1>
          {/* items-stretch: the CTA stack is one column whose width is set by
              its widest line (the ghost row); the capsule stretches to match
              (w-full below), so both lines are always EXACTLY as wide. */}
          <div className="-translate-y-[22%] mt-[clamp(28px,4vh,52px)] flex flex-col items-stretch">
            {/* Two layers on purpose: this motion.div owns the scroll-driven
                transforms, the button owns the hover transform in CSS. Putting a
                whileHover scale on the same element as style={{ scale }} would give
                two systems one property — they fight and the value gets stranded. */}
            {/* `group` lives HERE, not on the button: the hover target must be an
                element the hover itself doesn't move. If the button judged its own
                hover, the 3px lift would carry it off the cursor at the edges —
                hover ends, it drops back on, and it shakes in a feedback loop. */}
            <motion.div
              style={{ opacity: btnOpacity, y: btnY, scale: btnScale }}
              // No static will-change: it pins a raster layer and blurs the text
              // (same bug as the TripDeck cards) — motion adds it while animating.
              className="group pointer-events-auto relative"
            >
              {/* Ocean halo — blooms behind the glass on hover (Kimi's stage glow). */}
              <span
                aria-hidden
                className="pointer-events-none absolute -inset-24 opacity-0 transition-opacity duration-[450ms] ease-out group-hover:opacity-100"
                style={{ background: 'radial-gradient(closest-side, rgba(91,136,178,0.28), transparent 72%)' }}
              />
              {/* MILK glass capsule — the full glass-card recipe: white/40 fill,
                  50px blur (desktop), the big white inner glow (30px/15px; the
                  recipe's alpha 1.5 clamps to 1), 1px insets + edge rims. Light
                  surface → dark graphite text (cream text was unreadable on the
                  clear-glass variant; the milk is the readability fix). Hover
                  brightens the fill to CLOUD (briefing-cream) with the Ocean
                  glows + halo behind.
                  MOBILE: no backdrop-blur — iOS renders the blur in tiles, and
                  the scroll-driven y/scale/opacity on the wrapper resamples a
                  moving backdrop every frame, so tile seams show as lines across
                  the button. The white/40 fill + glow carry the milk without it. */}
              <button
                onClick={scrollToPathways}
                className="pointer-events-auto relative z-20 inline-flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-full border border-white/30 bg-white/40 px-[clamp(17px,2vw,36px)] py-[clamp(13px,1.4vh,17px)] font-headline text-[clamp(23px,1.5vw,26px)] font-semibold tracking-[-0.01em] text-graphite md:backdrop-blur-[50px] shadow-[0_8px_32px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(255,255,255,0.1),inset_0_0_30px_15px_rgba(255,255,255,1)] transition-[transform,box-shadow,background-color] duration-[350ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] group-hover:-translate-y-[2px] group-hover:bg-briefing-cream/80 group-hover:shadow-[0_8px_32px_rgba(91,136,178,0.22),0_24px_60px_rgba(91,136,178,0.28),inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(255,255,255,0.1),inset_0_0_30px_15px_rgba(255,255,255,1)] active:translate-y-0 active:scale-[0.985]"
              >
                {/* Light-catch rims: 1px top + left edge highlights. */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-px"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)' }}
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-0 top-0 h-full w-px"
                  style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.8), transparent, rgba(255,255,255,0.3))' }}
                />
                {/* Japan map silhouette — shared JapanIcon (also the preview's
                    Prefectures stat tile); fill-current tracks the text color. */}
                <JapanIcon className="mr-3 h-[1.35em] w-[1.35em] shrink-0" />
                Explore!
              </button>
            </motion.div>
            {/* Secondary CTA row — link-weight ghosts UNDER the primary (one
                hero object, two quiet destinations): the catalog, and the
                user's own trips (/my-trip itself bounces guests to sign-in).
                OUTSIDE the `group` above so hovering these never blooms
                Explore!'s halo; own motion.div reusing the same scroll values
                (minus scale — at ghost size the shrink read as jitter). NO
                backdrop-blur: these move with the scroll transforms, and a
                moving backdrop filter resamples every frame (the exact
                hero-lag class we just removed). */}
            <motion.div
              style={{ opacity: btnOpacity, y: btnY }}
              className="pointer-events-auto mt-[clamp(14px,2.2vh,24px)] grid grid-cols-2 gap-3"
            >
              {/* grid-cols-2: both ghosts get IDENTICAL widths (sized by the
                  longer label), and the row's edges align with the capsule
                  above (the column stretches it to match). Soft white fill +
                  icon + hover lift give them real click-appeal while staying
                  clearly subordinate to the milk glass. */}
              <Link
                href="/discover"
                className="group/g1 flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white/40 bg-white/15 px-4 py-2.5 font-headline text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-[2px] hover:border-white/70 hover:bg-white/25 hover:shadow-[0_6px_20px_rgba(91,136,178,0.35)]"
              >
                <Compass size={15} strokeWidth={2.25} className="shrink-0 transition-transform duration-300 group-hover/g1:rotate-45" aria-hidden />
                Browse Trips
              </Link>
              <Link
                href="/my-trip"
                className="group/g2 flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white/40 bg-white/15 px-4 py-2.5 font-headline text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-[2px] hover:border-white/70 hover:bg-white/25 hover:shadow-[0_6px_20px_rgba(91,136,178,0.35)]"
              >
                <Ticket size={15} strokeWidth={2.25} className="shrink-0 transition-transform duration-300 group-hover/g2:-rotate-12" aria-hidden />
                My Trips
              </Link>
            </motion.div>
          </div>
        </motion.div>

        {/* Learn More cue (bottom-left) — navigates to /discover, giving the
            hero's two CTAs two DISTINCT destinations: Explore! scrolls the
            on-page story, this one jumps straight to the full catalog. */}
        <Link
          href="/discover"
          aria-label="Learn more — browse all trips"
          className="group absolute left-[clamp(28px,4vw,72px)] bottom-[clamp(28px,4vh,56px)] z-20 flex flex-col items-center gap-3.5 cursor-pointer"
        >
          <span
            className="w-px h-[clamp(60px,12vh,120px)]"
            style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.7) 100%)' }}
          />
          <span
            className="font-headline font-semibold text-[11px] tracking-[0.32em] uppercase text-white/80 group-hover:text-basel-brick transition-colors"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            Learn More
          </span>
        </Link>

        {/* Socials (bottom-right) — official Simple Icons: one consistent grid, uniform size, centered */}
        <div className="absolute right-[clamp(28px,4vw,72px)] bottom-[clamp(28px,4vh,56px)] z-20 flex items-center gap-4 text-white/85">
          <a
            href="https://www.instagram.com/dopamichi.jp/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="flex items-center justify-center w-6 h-6 shrink-0 hover:text-basel-brick hover:scale-110 transition-all duration-200"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="block" aria-hidden="true"><path d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077" /></svg>
          </a>
          <a
            href="https://www.facebook.com/profile.php?id=61591588770624"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook"
            className="flex items-center justify-center w-6 h-6 shrink-0 hover:text-basel-brick hover:scale-110 transition-all duration-200"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="block" aria-hidden="true"><path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" /></svg>
          </a>
          <a
            href="https://www.tiktok.com/@dopamichi"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="TikTok"
            className="flex items-center justify-center w-6 h-6 shrink-0 hover:text-basel-brick hover:scale-110 transition-all duration-200"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="block" aria-hidden="true"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" /></svg>
          </a>
        </div>
      </section>

      {/* Continuous gradient for the whole lower page (pathways → content grid),
          fading from the hero's Midnight seam (#0A1B33) down to Cloud (#F7F9FC)
          so it blends into the light footer. */}
      <div style={{ background: 'linear-gradient(180deg,#0A1B33 0%,#F7F9FC 100%)' }}>
        {/* Value statement — the "why dopamichi" promise between the brand
            moment (hero) and the proof (trips): kicker / gradient-sweep
            headline (the pitch's first sentence) / muted body (the rest).
            Statement-block anatomy per the user's reference; the sweep is
            Ocean-only — the palette has no warm accent. */}
        <section className="px-8 pt-16 md:pt-24">
          <div className="mx-auto w-full max-w-[1536px]">
            <p className="font-headline text-xs font-bold uppercase tracking-[0.35em] text-briefing-cream/50">
              01 / Why dopamichi
            </p>
            <ScrollRevealStatement />
          </div>
        </section>

        {/* Second viewport — Featured trips. Newest published templates, opened via
            the shared PlanPreviewModal (same as /discover). Keeps the #pathways id so
            Start Journey / Learn More still scroll here. */}
        <section
          id="pathways"
          // overflow-hidden: the coverflow breaks out to w-screen (100vw), which
          // is wider than the content box when a vertical scrollbar is present —
          // this absorbs that overshoot instead of letting the page scroll
          // sideways. The filter modal is `fixed`, so it isn't clipped by this.
          className="overflow-hidden px-8 py-12 md:py-24 scroll-mt-24 min-h-screen flex flex-col justify-start md:justify-center text-briefing-cream"
        >
          <div className="max-w-[1536px] mx-auto w-full">
            {/* The whole search + filter + cards experience — ONE shared unit
                with /discover (app/components/TripSearchSection.tsx): search
                pill, filter modal, chips, the TripDeck, preview modal. */}
            <TripSearchSection
              title="Ready-to-go Trips"
              subtitle="จัดทริปไว้ให้ พร้อมไปได้เลย!"
              callbackUrl="/"
              // 5, not 3: the desktop coverflow has five slots (centre + two
              // each side), so fewer trips leave the fan lopsided.
              defaultCount={5}
              viewAllHref="/discover"
            />
          </div>
        </section>

      {/* Content Preview Grid */}
      <section className="px-4 sm:px-8 py-12 sm:py-24 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:h-[500px]">
          <div className="md:col-span-2 relative bg-zen-black group overflow-hidden h-64 md:h-full">
            <Image
              src={IMG.homeTokyo}
              alt="Tokyo"
              fill
              className="object-cover grayscale opacity-50 transition-all duration-700 group-hover:scale-105 group-hover:opacity-100 group-hover:grayscale-0"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            <div className="absolute inset-0 p-10 flex flex-col justify-end">
              <h4 className="text-briefing-cream text-4xl font-headline font-bold uppercase tracking-tight">Tokyo Nights</h4>
            </div>
          </div>

          <div className="md:col-span-2 grid grid-cols-2 gap-4">
            <div className="relative bg-zen-black group overflow-hidden h-48 md:h-full">
              <Image
                src={IMG.homeKyoto}
                alt="Kyoto"
                fill
                className="object-cover grayscale opacity-50 group-hover:opacity-100 group-hover:grayscale-0 transition-all"
                sizes="(max-width: 768px) 100vw, 25vw"
              />
              <div className="absolute inset-0 p-6 flex flex-col justify-end">
                <h4 className="text-briefing-cream font-headline font-bold uppercase text-sm">Zen Heritage</h4>
              </div>
            </div>

            <div className="relative bg-zen-black group overflow-hidden h-48 md:h-full">
              <Image
                src={IMG.homeFuji}
                alt="Fuji"
                fill
                className="object-cover grayscale opacity-50 group-hover:opacity-100 group-hover:grayscale-0 transition-all"
                sizes="(max-width: 768px) 100vw, 25vw"
              />
              <div className="absolute inset-0 p-6 flex flex-col justify-end">
                <h4 className="text-briefing-cream font-headline font-bold uppercase text-sm">The Peak</h4>
              </div>
            </div>

          </div>
        </div>
      </section>
      </div>

      {/* Status-bar top fade — VIEWPORT-fixed and LAST in the page's paint
          order: iOS paints the status bar flat #334155 (the root background),
          so this hugs the screen top at every scroll position and dissolves
          whatever slides under it, hero to footer. It must sit at the END of
          main — inside the hero it was painted over by the later positioned/
          transformed sections (coverflow cards) as they scrolled up. z-30:
          above all page content, below every navbar control (z-40+). */}
      <div
        aria-hidden
        className="fixed inset-x-0 top-0 z-30 h-24 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, #334155 0%, rgba(51,65,85,0.55) 35%, rgba(51,65,85,0) 100%)',
        }}
      />
    </main>
  )
}
