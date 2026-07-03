'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Heart } from 'lucide-react'
import { useSession, signIn } from 'next-auth/react'
import { useSavedTemplates } from '@/app/hooks/useSavedTemplates'
import PlanCard, { type PlanTemplate } from '@/app/components/PlanCard'
import PlanPreviewModal from '@/app/components/PlanPreviewModal'

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

  return (
    <main className="pt-32 pb-24 px-6 max-w-7xl mx-auto">
      <header className="mb-12">
        <div className="flex items-center gap-3 mb-6">
          <Heart size={28} fill="#B43325" stroke="#B43325" strokeWidth={2.5} />
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-headline font-extrabold tracking-tighter text-basel-brick">
            แพลนที่คุณชอบ
          </h1>
        </div>
        <p className="text-zen-black/70 text-lg max-w-2xl leading-relaxed font-sans">
          แพลนพร้อมเที่ยวที่คุณกดหัวใจเก็บไว้
        </p>
        <p className="text-zen-black/40 text-sm mt-1 font-sans">Your saved pre-planned trips</p>
      </header>

      {status === 'unauthenticated' ? (
        <div className="border-2 border-dashed border-zen-black/10 rounded-xl p-16 text-center">
          <p className="text-zen-black/60 font-sans text-lg mb-6">เข้าสู่ระบบเพื่อดูแพลนที่คุณบันทึกไว้</p>
          <button
            onClick={() => signIn(undefined, { callbackUrl: '/saved' })}
            className="px-6 py-3 bg-basel-brick text-white font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black transition-all"
          >
            Sign in
          </button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-white p-4 rounded-xl animate-pulse">
              <div className="aspect-[4/5] bg-zen-black/5 rounded-lg mb-6" />
              <div className="h-6 bg-zen-black/10 rounded mb-2" />
              <div className="h-4 bg-zen-black/5 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : saved.length === 0 ? (
        <div className="border-2 border-dashed border-zen-black/10 rounded-xl p-16 text-center">
          <p className="text-zen-black/60 font-sans text-lg mb-2">ยังไม่มีแพลนที่บันทึกไว้</p>
          <p className="text-zen-black/40 font-sans text-sm mb-6">
            กดรูปหัวใจบนแพลนที่ชอบเพื่อเก็บไว้ที่นี่ · Heart a trip to save it here
          </p>
          <Link
            href="/discover"
            className="inline-block px-6 py-3 bg-basel-brick text-white font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black transition-all"
          >
            เลือกแพลนพร้อมเที่ยว
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {saved.map((tpl) => (
            <PlanCard
              key={tpl.id}
              tpl={tpl}
              isSaved={savedIds.has(tpl.id)}
              isPending={pending.has(tpl.id)}
              onOpen={() => setSelectedId(tpl.id)}
              onHeart={(e) => toggleHeart(tpl.id, e)}
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
