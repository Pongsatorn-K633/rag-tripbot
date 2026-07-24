'use client'

import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Compass, ArrowRight, Search, SlidersHorizontal, X, ChevronDown, Check } from 'lucide-react'
import { motion, AnimatePresence, useScroll, useTransform, useMotionTemplate, useReducedMotion, type MotionValue } from 'motion/react'
import { IMG } from '@/lib/images'
import { smoothScrollTo } from '@/lib/smooth-scroll'
import { type PlanTemplate } from '@/app/components/PlanCard'
import TripDeck, { TripCard, DECK_CARD_W, DECK_CARD_H } from '@/app/components/TripDeck'
import PlanPreviewModal from '@/app/components/PlanPreviewModal'
import { useSavedTemplates } from '@/app/hooks/useSavedTemplates'
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
  const opacity = useTransform(progress, [0, start, end], reduced ? [0.94, 0.94, 0.94] : [0.94, 0.94, 0])
  const y = useTransform(progress, [0, start, end], reduced ? ['0%', '0%', '0%'] : ['0%', `${-20 * drift}%`, `${-85 * drift}%`])
  const x = useTransform(progress, [0, start, end], reduced ? [0, 0, 0] : [0, 0.25 * xScatter, xScatter])
  const rotate = useTransform(progress, [0, start, end], reduced ? [0, 0, 0] : [0, 0.4 * rot, rot])
  const blurPx = useTransform(progress, [0, 0.2 + stagger, end], reduced ? [0, 0, 0] : [0, 3, 14])
  const filter = useMotionTemplate`blur(${blurPx}px)`
  return (
    <motion.span className="inline-block will-change-transform" style={{ opacity, y, x, rotate, filter }}>
      {char}
    </motion.span>
  )
}

// How far PAST the Featured Trips top edge the hero cues land. Bump this to sink
// the landing lower into the section; 0 puts the section's top at the viewport top.
const PATHWAYS_OFFSET = 30

// ── Featured Trips search + filters ─────────────────────────────────────────
// Season chips (not a month-range picker): one tap, matches the season-emoji
// vocabulary, and precise date filtering already lives on /discover.
const SEASONS = [
  { key: 'Winter', emoji: '❄️', months: 'Dec – Feb' },
  { key: 'Spring', emoji: '🌸', months: 'Mar – May' },
  { key: 'Summer', emoji: '☀️', months: 'Jun – Aug' },
  { key: 'Autumn', emoji: '🍁', months: 'Sep – Nov' },
] as const
// Top tourist prefectures (Thai-market recognition order). Edit freely — chips
// self-prune to prefectures that actually have published trips.
const TOP_PREFECTURES = ['Tokyo', 'Osaka', 'Kyoto', 'Hokkaido', 'Fukuoka', 'Okinawa', 'Nagano', 'Nara', 'Yamanashi', 'Gifu']
const SEASON_OF_MONTH = ['Winter', 'Winter', 'Spring', 'Spring', 'Spring', 'Summer', 'Summer', 'Summer', 'Autumn', 'Autumn', 'Autumn', 'Winter']

/** Custom dropdown for the filter modal (Cloud theme). Options can carry a
 *  `sub` line — e.g. season months — so labels never truncate.
 *  (Native <select> was tried: the OS-drawn open list can't be styled.) */
function FilterSelect({
  label,
  display,
  open,
  onToggle,
  options,
  value,
  onPick,
}: {
  label: string
  display: string
  open: boolean
  onToggle: () => void
  options: { value: string; label: string; sub?: string; disabled?: boolean }[]
  value: string
  onPick: (v: string) => void
}) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-graphite/70">{label}</p>
      <div className="relative mt-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-2 rounded-full border border-zen-black/15 bg-white px-4 py-2.5 text-sm font-semibold text-zen-black transition-colors hover:border-basel-brick/50"
        >
          <span className="truncate">{display}</span>
          <ChevronDown
            className={`size-4 shrink-0 text-graphite/60 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
        {open && (
          <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-zen-black/10 bg-white shadow-xl shadow-black/15">
            {options.map((o) => {
              const active = o.value === value
              return (
                <button
                  key={o.value}
                  type="button"
                  disabled={o.disabled}
                  onClick={() => onPick(o.value)}
                  className={`flex w-full items-center justify-between gap-2 px-4 py-2 text-left transition-colors ${
                    o.disabled ? 'cursor-not-allowed' : active ? 'bg-basel-brick/10' : 'hover:bg-zen-black/5'
                  }`}
                >
                  <span className="min-w-0">
                    <span
                      className={`block truncate text-sm ${
                        o.disabled
                          ? 'font-medium text-graphite/35'
                          : active
                            ? 'font-bold text-zen-black'
                            : 'font-medium text-graphite'
                      }`}
                    >
                      {o.label}
                    </span>
                    {o.sub && (
                      <span className={`block text-[11px] ${o.disabled ? 'text-graphite/35' : 'text-graphite/60'}`}>
                        {o.sub}
                      </span>
                    )}
                  </span>
                  {active && <Check className="size-4 shrink-0 text-basel-brick" strokeWidth={2.5} aria-hidden />}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/** Seasons a trip spans — from its recommended windows' endpoint months
 *  (Template.season is a single value; multi-window trips span several). */
function templateSeasons(t: PlanTemplate): Set<string> {
  const s = new Set<string>()
  for (const r of t.availability?.recommended ?? []) {
    for (const end of [r.from, r.to]) {
      const m = parseInt(String(end ?? '').slice(0, 2), 10)
      if (m >= 1 && m <= 12) s.add(SEASON_OF_MONTH[m - 1])
    }
  }
  if (!s.size && t.season) s.add(t.season)
  return s
}

export default function Home() {
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

  // Featured trips (second viewport) — newest published templates, opened via the
  // same PlanPreviewModal as /discover.
  const [templates, setTemplates] = useState<PlanTemplate[]>([])
  const [tripsLoading, setTripsLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedTemplate = selectedId ? templates.find((t) => t.id === selectedId) ?? null : null
  const featured = [...templates].slice(-3).reverse() // newest 3 (API is createdAt asc)
  const { savedIds, pending, toggleHeart } = useSavedTemplates('/')

  // Search + filters (Destination / Season). No filter → the newest 3.
  const [query, setQuery] = useState('')
  const [dest, setDest] = useState<string | null>(null)
  const [season, setSeason] = useState<string | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  // Which custom dropdown is open inside the filter modal (only one at a time).
  const [ddOpen, setDdOpen] = useState<'season' | 'dest' | null>(null)
  const activeFilterCount = (dest ? 1 : 0) + (season ? 1 : 0)

  // Auto-collapse the filter modal if the page scrolls far from the search bar
  // (the scrim doesn't lock background scroll — desktop wheel keeps working).
  useEffect(() => {
    if (!filterOpen) return
    const startY = window.scrollY
    const onScroll = () => {
      if (Math.abs(window.scrollY - startY) > 250) setFilterOpen(false)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [filterOpen])
  // Destinations: ALL top tourist prefectures are listed; ones without a
  // published trip are disabled + "Coming soon" (markets the roadmap without
  // letting anyone filter into an empty result).
  const availableDest = new Set(
    TOP_PREFECTURES.filter((p) => templates.some((t) => t.title.toLowerCase().includes(p.toLowerCase()))),
  )
  const q = query.trim().toLowerCase()
  const filtering = !!(q || dest || season)
  const shown = filtering
    ? [...templates]
        .reverse() // newest first
        .filter((t) => {
          if (q && !`${t.title} ${t.description ?? ''}`.toLowerCase().includes(q)) return false
          if (dest && !t.title.toLowerCase().includes(dest.toLowerCase())) return false
          if (season && !templateSeasons(t).has(season)) return false
          return true
        })
    : featured

  useEffect(() => {
    let active = true
    fetch('/api/templates')
      .then((r) => (r.ok ? r.json() : { templates: [] }))
      .then((d) => { if (active) setTemplates(d.templates ?? []) })
      .catch(() => {})
      .finally(() => { if (active) setTripsLoading(false) })
    return () => { active = false }
  }, [])

  return (
    <main className="bg-zen-black">
      {/* Full-bleed photo hero */}
      <section ref={heroRef} className="relative w-full h-screen min-h-[660px] overflow-hidden bg-zen-black">
        <Image
          src={IMG.homeHero}
          alt="Mt. Fuji rising behind a Lawson convenience store at dusk"
          fill
          priority
          className="object-cover object-[60%_42%] md:object-[center_42%] z-0"
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
          <div className="-translate-y-[22%] mt-[clamp(28px,4vh,52px)]">
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
                className="pointer-events-auto relative z-20 inline-flex cursor-pointer items-center justify-center overflow-hidden rounded-full border border-white/30 bg-white/40 px-[clamp(17px,2vw,36px)] py-[clamp(10px,1.4vh,17px)] font-headline text-[clamp(17px,1.5vw,26px)] font-semibold tracking-[-0.01em] text-graphite md:backdrop-blur-[50px] shadow-[0_8px_32px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(255,255,255,0.1),inset_0_0_30px_15px_rgba(255,255,255,1)] transition-[transform,box-shadow,background-color] duration-[350ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] group-hover:-translate-y-[2px] group-hover:bg-briefing-cream/80 group-hover:shadow-[0_8px_32px_rgba(91,136,178,0.22),0_24px_60px_rgba(91,136,178,0.28),inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(255,255,255,0.1),inset_0_0_30px_15px_rgba(255,255,255,1)] active:translate-y-0 active:scale-[0.985]"
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
          </div>
        </motion.div>

        {/* Learn More cue (bottom-left) */}
        <button
          onClick={scrollToPathways}
          aria-label="Learn more"
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
        </button>

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
        {/* Second viewport — Featured trips. Newest published templates, opened via
            the shared PlanPreviewModal (same as /discover). Keeps the #pathways id so
            Start Journey / Learn More still scroll here. */}
        <section
          id="pathways"
          className="px-8 py-12 md:py-24 scroll-mt-24 min-h-screen flex flex-col justify-start md:justify-center text-briefing-cream"
        >
          <div className="max-w-[1536px] mx-auto w-full">
            <div className="mb-10">
              <div className="md:flex md:items-center md:justify-between md:gap-4">
                <div>
                  <h2 className="font-headline font-bold text-3xl md:text-5xl tracking-tight">Featured Trips</h2>
                  <p className="mt-1.5 text-briefing-cream/70 font-sans">Ready-to-go Japan itineraries.</p>
                </div>
                {/* Desktop: View all centered vertically against the title + subtitle block */}
                <Link
                  href="/discover"
                  className="group shrink-0 hidden md:flex items-center gap-2 font-headline font-bold uppercase tracking-widest text-sm text-briefing-cream/80 hover:text-basel-brick transition-colors"
                >
                  View all
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
              {/* Search — filter button INSIDE the field (far right); the chips
                  live in the collapsible panel below. Quick first cut; precise
                  dates live on /discover. */}
              <div className="relative mt-5 max-w-md">
                <div className="relative">
                  {/* z-10: the input's backdrop-blur creates a stacking context
                      that otherwise paints OVER this earlier-DOM icon. */}
                  <Search className="pointer-events-none absolute left-4 top-1/2 z-10 size-4 -translate-y-1/2 text-briefing-cream/40" aria-hidden />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="ค้นหาทริป · Find a trip…"
                    className="w-full rounded-full border border-white/15 bg-white/10 py-2.5 pl-11 pr-12 text-sm text-briefing-cream outline-none backdrop-blur-sm transition-colors placeholder:text-briefing-cream/40 focus:border-basel-brick/60"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setFilterOpen((o) => !o)
                      setDdOpen(null)
                    }}
                    aria-expanded={filterOpen}
                    aria-label="ตัวกรอง · Filters"
                    className={`absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full transition-colors ${
                      filterOpen ? 'bg-briefing-cream text-zen-black' : 'text-briefing-cream/60 hover:bg-white/10 hover:text-briefing-cream'
                    }`}
                  >
                    <SlidersHorizontal className="size-4" strokeWidth={2.25} />
                    {activeFilterCount > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-basel-brick text-[9px] font-bold text-white">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                </div>

                {/* Active-filter bubbles — each removable with its own × */}
                {activeFilterCount > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {season && (
                      <button
                        type="button"
                        onClick={() => setSeason(null)}
                        className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-briefing-cream backdrop-blur-sm transition-colors hover:border-basel-brick/50"
                      >
                        {SEASONS.find((s) => s.key === season)?.emoji} {season}
                        <X className="size-3 text-briefing-cream/60" strokeWidth={2.5} aria-hidden />
                      </button>
                    )}
                    {dest && (
                      <button
                        type="button"
                        onClick={() => setDest(null)}
                        className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-briefing-cream backdrop-blur-sm transition-colors hover:border-basel-brick/50"
                      >
                        {dest}
                        <X className="size-3 text-briefing-cream/60" strokeWidth={2.5} aria-hidden />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Filter MODAL — overlays the whole page (the deck cards carry
                  their own z-indexes, so any in-page popover loses the paint
                  war). × or backdrop tap closes. */}
              <AnimatePresence>
                {filterOpen && (
                  <motion.div
                    key="filter-modal"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    style={{ backgroundColor: 'rgba(10,27,51,0.6)' }}
                    className="fixed inset-0 z-[80] flex items-center justify-center px-4"
                    onClick={(e) => {
                      if (e.target === e.currentTarget) setFilterOpen(false)
                    }}
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 12, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 12, scale: 0.97 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      // Cloud card — solid briefing-cream (glass went muddy over
                      // the dark scrim; a filter panel wants clarity, and this
                      // matches the app's modal language).
                      className="relative w-full max-w-sm rounded-3xl bg-briefing-cream p-5 font-detail shadow-2xl shadow-black/30"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-lg font-extrabold tracking-tight text-zen-black">What&apos;s your choice?</h3>
                        <button
                          type="button"
                          onClick={() => setFilterOpen(false)}
                          className="shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold text-basel-brick transition-colors hover:bg-basel-brick/10"
                        >
                          Done
                        </button>
                      </div>

                      {/* Season LEFT · Destination RIGHT */}
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <FilterSelect
                          label="Season · ฤดู"
                          display={
                            season
                              ? `${SEASONS.find((s) => s.key === season)?.emoji ?? ''} ${season}`
                              : 'ทั้งหมด · All'
                          }
                          open={ddOpen === 'season'}
                          onToggle={() => setDdOpen(ddOpen === 'season' ? null : 'season')}
                          value={season ?? ''}
                          options={[
                            { value: '', label: 'ทั้งหมด · All' },
                            // Months on their OWN small line — labels never truncate
                            ...SEASONS.map((s) => ({ value: s.key, label: `${s.emoji} ${s.key}`, sub: s.months })),
                          ]}
                          onPick={(v) => {
                            setSeason(v || null)
                            setDdOpen(null)
                          }}
                        />
                        <FilterSelect
                          label="Destination · จังหวัด"
                          display={dest ?? 'ทั้งหมด · All'}
                          open={ddOpen === 'dest'}
                          onToggle={() => setDdOpen(ddOpen === 'dest' ? null : 'dest')}
                          value={dest ?? ''}
                          options={[
                            { value: '', label: 'ทั้งหมด · All' },
                            // Live prefectures first, then coming-soon — each
                            // group alphabetical.
                            ...[...TOP_PREFECTURES]
                              .sort(
                                (a, b) =>
                                  Number(!availableDest.has(a)) - Number(!availableDest.has(b)) || a.localeCompare(b),
                              )
                              .map((p) => ({
                                value: p,
                                label: p,
                                disabled: !availableDest.has(p),
                                sub: availableDest.has(p) ? undefined : 'เร็วๆ นี้ · Coming soon',
                              })),
                          ]}
                          onPick={(v) => {
                            setDest(v || null)
                            setDdOpen(null)
                          }}
                        />
                      </div>

                      {activeFilterCount > 0 && (
                        <div className="mt-4 flex justify-end">
                          {/* mr-3 = Done's px-3 inset, so their right text edges align */}
                          <button
                            type="button"
                            onClick={() => {
                              setDest(null)
                              setSeason(null)
                            }}
                            className="mr-3 text-xs font-semibold text-graphite/70 underline-offset-2 hover:text-basel-brick hover:underline"
                          >
                            Reset
                          </button>
                        </div>
                      )}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {/* Mobile — swipeable deck (design + motion ported from the Kimi build) */}
            <div className="md:hidden">
              {tripsLoading ? (
                <div
                  style={{ width: DECK_CARD_W, height: DECK_CARD_H }}
                  className="mx-auto animate-pulse rounded-[20px] border border-white/10 bg-white/5"
                />
              ) : shown.length > 0 ? (
                <TripDeck
                  key={shown.map((t) => t.id).join('|')}
                  templates={shown}
                  savedIds={savedIds}
                  pending={pending}
                  onOpen={(id) => setSelectedId(id)}
                  onHeart={(id, e) => toggleHeart(id, e)}
                />
              ) : (
                <p className="text-center text-briefing-cream/50 font-sans">
                  {filtering ? 'ไม่พบทริปที่ตรงเงื่อนไข · No matching trips' : 'No featured trips yet.'}
                </p>
              )}
              {/* Mobile View all — AFTER the deck: browse cards → want more →
                  the natural next step. (Its old spot above the deck is now
                  the search + filter bubbles' home.) */}
              <Link
                href="/discover"
                className="group mx-auto mt-6 flex w-fit items-center gap-2 font-headline font-bold uppercase tracking-widest text-xs text-briefing-cream/70 transition-colors hover:text-basel-brick"
              >
                View all
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            {/* Desktop — same boarding-pass card as the mobile deck (shared
                CardFace), laid out as a static row with a hover lift. */}
            <div className="hidden md:flex flex-wrap justify-center gap-6 md:gap-8">
              {tripsLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      style={{ width: DECK_CARD_W, height: DECK_CARD_H }}
                      className="animate-pulse rounded-[20px] border border-white/10 bg-white/5"
                    />
                  ))
                : shown.length > 0
                  ? shown.map((tpl) => (
                      <TripCard
                        key={tpl.id}
                        tpl={tpl}
                        saved={savedIds.has(tpl.id)}
                        isPending={pending.has(tpl.id)}
                        onOpen={(id) => setSelectedId(id)}
                        onHeart={(id, e) => toggleHeart(id, e)}
                      />
                    ))
                  : (
                    <p className="w-full text-center text-briefing-cream/50 font-sans">
                      {filtering ? 'ไม่พบทริปที่ตรงเงื่อนไข · No matching trips' : 'No featured trips yet.'}
                    </p>
                  )}
            </div>
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

            <div className="col-span-2 bg-basel-brick flex flex-col items-center justify-center text-center p-8 text-briefing-cream">
              <Compass className="w-10 h-10 mb-2" strokeWidth={1.5} />
              <p className="font-headline font-bold text-2xl uppercase tracking-tighter">100K+ Explorers</p>
            </div>
          </div>
        </div>
      </section>
      </div>

      {/* Preview + duplicate modal — same component /discover uses to "open" a trip. */}
      <PlanPreviewModal
        template={selectedTemplate}
        callbackUrl="/"
        onClose={() => setSelectedId(null)}
      />
    </main>
  )
}
