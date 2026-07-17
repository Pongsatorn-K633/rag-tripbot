'use client'

import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Compass, ArrowRight } from 'lucide-react'
import { motion, useScroll, useTransform, useMotionTemplate, useReducedMotion, type MotionValue } from 'motion/react'
import { IMG } from '@/lib/images'
import { smoothScrollTo } from '@/lib/smooth-scroll'
import PlanCard, { type PlanTemplate } from '@/app/components/PlanCard'
import TripDeck, { DECK_CARD_W, DECK_CARD_H } from '@/app/components/TripDeck'
import PlanPreviewModal from '@/app/components/PlanPreviewModal'
import { useSavedTemplates } from '@/app/hooks/useSavedTemplates'

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
  const btnOpacity = useTransform(scrollYProgress, [0, 0.2, 0.45], reduced ? [1, 1, 1] : [1, 1, 0])
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
              className="group pointer-events-auto will-change-transform"
            >
              <button
                onClick={scrollToPathways}
                style={{
                  // Glass rim: a flat border reads as a translucent rectangle. Real
                  // glass catches light unevenly around its edge, so the border is a
                  // gradient — bright at the top-left and bottom-right, dim between.
                  // Needs a transparent border + two backgrounds clipped differently.
                  border: '1.5px solid transparent',
                  background:
                    'linear-gradient(180deg, rgba(255,255,255,0.13), rgba(255,255,255,0.05)) padding-box, ' +
                    'linear-gradient(150deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.22) 38%, rgba(255,255,255,0.1) 56%, rgba(255,255,255,0.75) 100%) border-box',
                }}
                // Hover = the slamm-ai hero-link recipe (quick 3px rise + brighten,
                // 220ms), re-skinned to glass: their orange border/tint becomes a
                // brighter white rim. backdrop-blur-md, not -xl: blur cost scales
                // with radius, and this repaints on every hero scroll frame.
                className="pointer-events-auto relative z-20 inline-flex items-center justify-center rounded-full backdrop-blur-md text-white font-headline font-bold uppercase tracking-[0.18em] text-[clamp(15px,1.15vw,19px)] px-[clamp(40px,4vw,90px)] py-[clamp(16px,1.8vh,22px)] shadow-[0_8px_32px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.35)] transition-[transform,box-shadow] duration-[220ms] group-hover:-translate-y-[3px] group-hover:shadow-[0_16px_40px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.5)] cursor-pointer"
              >
                {/* Hover brighten: gradients can't transition (they snap), so a
                    brighter copy of the fill+rim crossfades in via opacity. */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-[220ms] group-hover:opacity-100"
                  style={{
                    border: '1.5px solid transparent',
                    background:
                      'linear-gradient(180deg, rgba(255,255,255,0.2), rgba(255,255,255,0.09)) padding-box, ' +
                      'linear-gradient(150deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.45) 38%, rgba(255,255,255,0.3) 56%, rgba(255,255,255,0.9) 100%) border-box',
                  }}
                />
                <span className="relative">Start Journey</span>
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
                  <p className="mt-3 text-briefing-cream/70 font-sans">Ready-to-go Japan itineraries.</p>
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
              {/* Mobile: View all sits below the subtitle so it clears the top-right nav pill */}
              <Link
                href="/discover"
                className="group md:hidden mt-4 flex w-fit items-center gap-2 font-headline font-bold uppercase tracking-widest text-xs text-briefing-cream/70 hover:text-basel-brick transition-colors"
              >
                View all
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
            {/* Mobile — swipeable deck (design + motion ported from the Kimi build) */}
            <div className="md:hidden">
              {tripsLoading ? (
                <div
                  style={{ width: DECK_CARD_W, height: DECK_CARD_H }}
                  className="mx-auto animate-pulse rounded-[20px] border border-white/10 bg-white/5"
                />
              ) : featured.length > 0 ? (
                <TripDeck
                  key={featured.map((t) => t.id).join('|')}
                  templates={featured}
                  savedIds={savedIds}
                  pending={pending}
                  onOpen={(id) => setSelectedId(id)}
                  onHeart={(id, e) => toggleHeart(id, e)}
                />
              ) : (
                <p className="text-center text-briefing-cream/50 font-sans">No featured trips yet.</p>
              )}
            </div>

            {/* Desktop — the existing card row */}
            <div className="hidden md:flex flex-wrap justify-center gap-6 md:gap-8">
              {tripsLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="w-full sm:w-[340px] h-[460px] rounded-xl bg-white/5 border border-white/10 animate-pulse" />
                  ))
                : featured.length > 0
                  ? featured.map((tpl) => (
                      <div key={tpl.id} className="w-full sm:w-[340px]">
                        <PlanCard
                          tpl={tpl}
                          variant="light"
                          isSaved={savedIds.has(tpl.id)}
                          isPending={pending.has(tpl.id)}
                          onOpen={() => setSelectedId(tpl.id)}
                          onHeart={(e) => toggleHeart(tpl.id, e)}
                        />
                      </div>
                    ))
                  : (
                    <p className="w-full text-center text-briefing-cream/50 font-sans">No featured trips yet.</p>
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
