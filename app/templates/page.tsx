'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'motion/react'
import { ArrowRight, Heart, ChevronDown } from 'lucide-react'
import { useSession, signIn } from 'next-auth/react'
import { type Itinerary } from '@/app/components/TemplateCard'
import ItineraryCard from '@/app/components/ItineraryCard'
import ActivationBanner from '@/app/components/ActivationBanner'
import { resolveCoverImage } from '@/lib/cover-image'

const SEASON_MONTHS: Record<string, string> = {
  Winter: 'Dec–Feb',
  Spring: 'Mar–May',
  Summer: 'Jun–Aug',
  Autumn: 'Sep–Nov',
}

// Cover image resolution is centralized in lib/cover-image.ts — see that file
// for how stored IMG keys / URLs / null values are all normalized to a final URL.

// ── Types ────────────────────────────────────────────────────────────────────

interface TemplateRow {
  id: string
  title: string
  description: string | null
  itinerary: Itinerary
  coverImage: string | null
  totalDays: number
  season: string | null
  /** Canonical LINE share code — same for everyone, set by admin when the template is created */
  shareCode: string | null
  createdAt: string
}

interface SavedTripSlim {
  id: string
  templateId: string | null
  source: string | null
}

type SaveState = 'idle' | 'saving' | 'done'

export default function TemplatesPage() {
  const { data: session } = useSession()
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savedTemplateIds, setSavedTemplateIds] = useState<Set<string>>(new Set())
  const [heartPending, setHeartPending] = useState<Set<string>>(new Set())

  // Modal state
  const [savedOpen, setSavedOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [shareCode, setShareCode] = useState<string | null>(null)
  const [startDate, setStartDate] = useState('')

  const selectedTemplate = selectedId ? templates.find((t) => t.id === selectedId) ?? null : null

  // ── Fetch templates on mount ────────────────────────────────────────────────
  useEffect(() => {
    async function loadTemplates() {
      try {
        const res = await fetch('/api/templates')
        if (!res.ok) throw new Error('Failed to load templates')
        const data = await res.json()
        setTemplates(data.templates ?? [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadTemplates()
  }, [])

  // ── Fetch which templates the signed-in user has already saved ─────────────
  useEffect(() => {
    if (!session?.user) {
      setSavedTemplateIds(new Set())
      return
    }
    async function loadSaved() {
      try {
        const res = await fetch('/api/trips')
        if (!res.ok) return
        const data = await res.json()
        const ids = new Set<string>(
          (data.trips as SavedTripSlim[])
            .filter((t) => t.source === 'template' && t.templateId)
            .map((t) => t.templateId as string)
        )
        setSavedTemplateIds(ids)
      } catch {
        // silently ignore
      }
    }
    loadSaved()
  }, [session])

  // ── Heart / unheart handler ─────────────────────────────────────────────────
  async function toggleHeart(templateId: string, e: React.MouseEvent) {
    e.stopPropagation() // don't open the modal when clicking the heart
    if (!session?.user) {
      signIn(undefined, { callbackUrl: '/templates' })
      return
    }
    if (heartPending.has(templateId)) return

    const isSaved = savedTemplateIds.has(templateId)
    setHeartPending((prev) => new Set(prev).add(templateId))
    // Optimistic update
    setSavedTemplateIds((prev) => {
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
      // Roll back on failure
      setSavedTemplateIds((prev) => {
        const next = new Set(prev)
        if (isSaved) next.add(templateId)
        else next.delete(templateId)
        return next
      })
      alert('ไม่สามารถบันทึกได้ กรุณาลองใหม่')
    } finally {
      setHeartPending((prev) => {
        const next = new Set(prev)
        next.delete(templateId)
        return next
      })
    }
  }

  // ── Modal confirm: save the template and mint a share code for LINE ────────
  async function handleConfirm() {
    if (!selectedTemplate) return

    if (!session?.user) {
      signIn(undefined, { callbackUrl: '/templates' })
      return
    }

    setSaveState('saving')

    try {
      // Idempotent save — creates the user's personal Trip copy of the
      // template (for their gallery) but does NOT mint a per-user share code.
      // All sharing goes through the canonical Template.shareCode so every
      // user sees the same code the admin does.
      const saveRes = await fetch(`/api/templates/${selectedTemplate.id}/save`, {
        method: 'POST',
      })
      if (!saveRes.ok) throw new Error('Failed to save template')

      // Mark as saved in the heart state too
      setSavedTemplateIds((prev) => new Set(prev).add(selectedTemplate.id))

      // Show the canonical template share code (not a fresh per-user code).
      // This is the same code displayed in the admin dashboard, so distributing
      // the template is consistent across everyone.
      setShareCode(selectedTemplate.shareCode)
      setSaveState('done')
    } catch (err) {
      console.error('Save error:', err)
      setSaveState('idle')
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    }
  }

  function handleClose() {
    setSelectedId(null)
    setSaveState('idle')
    setShareCode(null)
    setStartDate('')
  }

  return (
    <main className="pt-32 pb-24 px-6 max-w-7xl mx-auto">
      {/* Hero header */}
      <header className="mb-20">
        <h1 className="text-4xl md:text-5xl lg:text-7xl font-headline font-extrabold tracking-tighter text-basel-brick mb-6">
          Template Gallery
        </h1>
        <p className="text-zen-black/70 text-lg max-w-2xl leading-relaxed font-sans">
          เลือกแผนการเดินทางที่คัดสรรแล้ว แล้วปรับแต่งตามต้องการได้เลย
        </p>
        <p className="text-zen-black/40 text-sm mt-1 font-sans">
          Curated Japan itineraries — pick one and make it yours
        </p>
      </header>

      {/* Your Saved — collapsible accordion, CLOSED by default.
          The header is always visible (when signed in) showing the count.
          Click to expand/collapse. No viewport disruption. */}
      {/* Your Saved — collapsible accordion, CLOSED by default.
          Always visible when signed in (even with 0 saves) so the layout
          never shifts. Click the header to expand/collapse. */}
      {session?.user && (
        <div className="mb-10 border border-zen-black/10 bg-white/50">
          {/* Accordion header — always visible, clickable */}
          <button
            onClick={() => setSavedOpen(!savedOpen)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-briefing-cream/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Heart size={16} fill={savedTemplateIds.size > 0 ? '#B43325' : 'none'} stroke="#B43325" strokeWidth={2.5} />
              <span className="font-headline font-black text-sm tracking-tight text-zen-black">
                เทมเพลตที่คุณชอบ · Your Saved
              </span>
              {savedTemplateIds.size > 0 && (
                <span className="bg-basel-brick text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                  {savedTemplateIds.size}
                </span>
              )}
            </div>
            <ChevronDown
              size={18}
              className={`text-zen-black/40 transition-transform duration-300 ${
                savedOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Accordion content — animated expand/collapse */}
          <AnimatePresence initial={false}>
            {savedOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-6 pt-2">
                  {savedTemplateIds.size === 0 ? (
                    <div className="py-8 text-center border-2 border-dashed border-zen-black/10">
                      <p className="text-zen-black/40 text-sm font-sans">
                        กดรูปหัวใจเพื่อบันทึกเทมเพลตที่ชอบ · Heart a template below to save it here
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                      <AnimatePresence mode="popLayout">
                        {templates
                          .filter((t) => savedTemplateIds.has(t.id))
                          .map((tpl) => {
                            const imgSrc = resolveCoverImage(tpl.coverImage, tpl.id)
                            return (
                              <motion.div
                                key={tpl.id}
                                layout
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{
                                  opacity: 0,
                                  scale: 0.85,
                                  filter: 'blur(6px)',
                                  transition: { duration: 0.35 },
                                }}
                                whileHover={{ y: -6 }}
                                transition={{ layout: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } }}
                                onClick={() => {
                                  setSelectedId(tpl.id)
                                  setSaveState('idle')
                                  setShareCode(null)
                                }}
                                className="group relative bg-white p-3 rounded-lg shadow-sm hover:shadow-xl transition-shadow cursor-pointer"
                              >
                                <button
                                  onClick={(e) => toggleHeart(tpl.id, e)}
                                  aria-label="Unsave"
                                  className="absolute top-4 right-4 z-20 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                                >
                                  <Heart size={14} fill="#B43325" stroke="#B43325" strokeWidth={2.5} />
                                </button>
                                <div className="relative aspect-[4/3] overflow-hidden mb-3 bg-briefing-cream rounded">
                                  <Image
                                    src={imgSrc}
                                    alt={tpl.title}
                                    fill
                                    className="object-cover transition-all duration-500 group-hover:scale-105"
                                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                  />
                                  <div className="absolute bottom-0 left-0 w-full p-3 bg-gradient-to-t from-zen-black/80 to-transparent">
                                    <span className="bg-basel-brick text-briefing-cream px-2 py-0.5 text-[9px] font-black uppercase tracking-widest font-headline">
                                      {tpl.totalDays}D{tpl.season ? ` · ${tpl.season}` : ''}
                                    </span>
                                  </div>
                                </div>
                                <h3 className="text-sm font-headline font-bold text-zen-black truncate">
                                  {tpl.title}
                                </h3>
                                <p className="text-[10px] text-zen-black/40 font-bold uppercase tracking-widest">
                                  {tpl.season ?? ''}
                                </p>
                              </motion.div>
                            )
                          })}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Section header */}
      <div className="flex flex-col md:flex-row justify-between md:items-end mb-16 gap-4 md:gap-6 border-b-2 border-zen-black/5 pb-8">
        <div>
          <span className="text-basel-brick font-extrabold text-sm uppercase tracking-[0.3em] mb-4 block font-headline">
            Curated Collections
          </span>
          <h2 className="text-3xl md:text-5xl font-headline font-black tracking-tighter text-zen-black">
            แพ็คเกจสำเร็จรูป
          </h2>
        </div>
      </div>

      {/* Template grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-white p-4 rounded-xl animate-pulse">
              <div className="aspect-[4/5] bg-zen-black/5 rounded-lg mb-6" />
              <div className="h-6 bg-zen-black/10 rounded mb-2" />
              <div className="h-4 bg-zen-black/5 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="border-2 border-dashed border-zen-black/10 rounded-xl p-16 text-center">
          <p className="text-zen-black/40 font-sans text-lg">ยังไม่มีแพ็คเกจในขณะนี้</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {templates.map((tpl) => {
            const isSaved = savedTemplateIds.has(tpl.id)
            const isPending = heartPending.has(tpl.id)
            const imgSrc = resolveCoverImage(tpl.coverImage, tpl.id)
            return (
              <motion.div
                key={tpl.id}
                whileHover={{ y: -10 }}
                className="group flex flex-col bg-white p-4 rounded-xl shadow-sm hover:shadow-2xl transition-all duration-300 cursor-pointer relative"
                onClick={() => {
                  setSelectedId(tpl.id)
                  setSaveState('idle')
                  setShareCode(null)
                }}
              >
                {/* Heart icon — save / unsave */}
                <button
                  onClick={(e) => toggleHeart(tpl.id, e)}
                  disabled={isPending}
                  aria-label={isSaved ? 'Unsave template' : 'Save template'}
                  className="absolute top-6 right-6 z-20 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform disabled:opacity-60"
                >
                  <motion.div
                    key={isSaved ? 'saved' : 'unsaved'}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  >
                    <Heart
                      size={18}
                      fill={isSaved ? '#B43325' : 'none'}
                      stroke={isSaved ? '#B43325' : '#231a0e'}
                      strokeWidth={2.5}
                    />
                  </motion.div>
                </button>

                <div className="relative aspect-[4/5] overflow-hidden mb-6 bg-briefing-cream rounded-lg">
                  <Image
                    src={imgSrc}
                    alt={tpl.title}
                    fill
                    className="object-cover transition-all duration-700 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  />
                  <div className="absolute bottom-0 left-0 w-full p-4 sm:p-6 bg-gradient-to-t from-zen-black/80 to-transparent">
                    <div className="flex flex-col gap-1.5">
                      <span className="bg-basel-brick text-briefing-cream px-3 py-1 text-[10px] font-black uppercase tracking-widest font-headline self-start">
                        {tpl.totalDays} DAYS
                      </span>
                      {tpl.season && (
                        <span className="bg-white/20 text-white px-3 py-1 text-[10px] font-black uppercase tracking-widest font-headline backdrop-blur-sm self-start">
                          {tpl.season}{SEASON_MONTHS[tpl.season] ? ` · ${SEASON_MONTHS[tpl.season]}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <h3 className="text-2xl font-headline font-bold text-zen-black mb-2">
                  {tpl.title}
                </h3>
                {tpl.description && (
                  <p className="text-zen-black/60 text-sm font-sans leading-relaxed mb-4">
                    {tpl.description}
                  </p>
                )}
                <button className="mt-auto text-basel-brick font-black text-xs uppercase tracking-widest flex items-center gap-2 group-hover:translate-x-2 transition-transform font-headline">
                  PREVIEW <ArrowRight size={14} />
                </button>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Modal overlay */}
      <AnimatePresence>
        {selectedTemplate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-4 sm:py-10 px-2 sm:px-4"
            style={{ backgroundColor: 'rgba(35,26,14,0.75)' }}
            onClick={(e) => {
              if (e.target === e.currentTarget && saveState !== 'saving') handleClose()
            }}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-lg bg-briefing-cream border border-zen-black/10 shadow-2xl overflow-hidden"
            >
              <div className="px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between border-b border-zen-black/10">
                <h2 className="font-headline font-black text-lg sm:text-xl tracking-tighter text-zen-black">
                  ยืนยันแผนการเดินทาง
                </h2>
                {saveState !== 'saving' && (
                  <button
                    onClick={handleClose}
                    className="text-zen-black/40 hover:text-zen-black text-2xl leading-none transition-colors"
                    aria-label="ปิด"
                  >
                    &times;
                  </button>
                )}
              </div>

              <div className="px-4 py-4">
                {saveState === 'done' && shareCode ? (
                  <>
                    <ActivationBanner shareCode={shareCode} />
                    <button
                      onClick={handleClose}
                      className="mt-4 w-full py-4 border border-zen-black/20 font-headline font-bold text-sm uppercase tracking-widest text-zen-black/60 hover:bg-zen-black hover:text-briefing-cream transition-all"
                    >
                      เลือกแพ็คเกจอื่น
                    </button>
                  </>
                ) : (
                  <>
                    <div className="mb-4 px-1">
                      <label className="block text-xs font-bold uppercase tracking-widest text-basel-brick mb-1">
                        วันเริ่มเดินทาง (ไม่ระบุก็ได้)
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        disabled={saveState === 'saving'}
                        className="w-full bg-briefing-cream border border-zen-black/20 px-4 py-3 font-medium text-sm text-zen-black focus:outline-none focus:border-basel-brick transition-colors disabled:opacity-40"
                      />
                    </div>
                    <ItineraryCard
                      itinerary={selectedTemplate.itinerary}
                      onConfirm={handleConfirm}
                      confirmLoading={saveState === 'saving'}
                    />
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
