'use client'

import { useState, useEffect, useRef, FormEvent } from 'react'
import { ChevronRight, Verified } from 'lucide-react'
import { useSession, signIn } from 'next-auth/react'

interface Activity {
  time: string
  name: string
  notes?: string
}

interface Day {
  day: number
  location: string
  activities: Activity[]
  accommodation: string
  transport: string
}

interface Itinerary {
  title?: string
  totalDays?: number
  season?: string
  days: Day[]
  shareCode?: string | null
}

interface Message {
  role: 'user' | 'bot'
  content: string
  itinerary?: Itinerary | null
  warning?: string | null
}

interface SavedTrip {
  tripId: string
  shareCode: string
}

// ── Itinerary day renderer (dopamichi style) ─────────────────────────────────

function ItineraryDayItem({ day }: { day: Day }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6">
        <div className="w-12 h-12 flex-shrink-0 bg-basel-brick text-white rounded-full flex items-center justify-center font-headline font-bold text-sm">
          {String(day.day).padStart(2, '0')}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-black text-zen-black tracking-tighter">{day.location}</h3>
          {day.activities.length > 0 && (
            <p className="text-[9px] text-basel-brick font-black uppercase tracking-[0.2em]">
              {day.activities.length} กิจกรรม
            </p>
          )}
        </div>
      </div>
      {day.activities.length > 0 && (
        <div className="ml-6 pl-10 border-l border-basel-brick/30 space-y-8 py-2">
          {day.activities.map((act, i) => (
            <div key={i} className="relative">
              <div className="absolute -left-[45px] top-1 w-2 h-2 bg-basel-brick" />
              <span className="text-[10px] font-black text-basel-brick">{act.time}</span>
              <h4 className="text-xs font-bold uppercase mt-1">{act.name}</h4>
              {act.notes && (
                <p className="text-[10px] text-zen-black/60 font-medium leading-relaxed mt-1">{act.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
      {(day.accommodation || day.transport) && (
        <div className="ml-6 pl-4 space-y-2">
          {day.accommodation && (
            <p className="text-[10px] text-zen-black/60 font-medium">
              <span className="font-bold text-zen-black uppercase tracking-widest">ที่พัก: </span>
              {day.accommodation}
            </p>
          )}
          {day.transport && (
            <p className="text-[10px] text-zen-black/60 font-medium">
              <span className="font-bold text-zen-black uppercase tracking-widest">เดินทาง: </span>
              {day.transport}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Right pane skeleton ──────────────────────────────────────────────────────

function ItinerarySkeleton() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-10 py-20 text-center gap-8">
      <div className="space-y-4 w-full max-w-sm">
        <div className="h-6 bg-zen-black/10 animate-pulse rounded" />
        <div className="h-4 bg-zen-black/5 animate-pulse rounded w-3/4 mx-auto" />
        <div className="border-2 border-dashed border-zen-black/10 rounded-lg p-8 space-y-3">
          <div className="h-4 bg-zen-black/5 animate-pulse rounded" />
          <div className="h-4 bg-zen-black/5 animate-pulse rounded w-5/6" />
          <div className="h-4 bg-zen-black/5 animate-pulse rounded w-4/6" />
        </div>
        <div className="border-2 border-dashed border-zen-black/10 rounded-lg p-8 space-y-3">
          <div className="h-4 bg-zen-black/5 animate-pulse rounded" />
          <div className="h-4 bg-zen-black/5 animate-pulse rounded w-3/6" />
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zen-black/30">Awaiting Itinerary</p>
        <p className="text-[9px] font-bold uppercase tracking-widest text-zen-black/20">Type your request on the left</p>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'bot',
      content:
        'สวัสดีค่ะ! ฉันคือ Dopamichi AI Concierge ผู้ช่วยวางแผนเที่ยวญี่ปุ่นสำหรับคนไทยค่ะ\nบอกฉันได้เลยว่าอยากไปเดือนไหน กี่วัน และสไตล์การเดินทางที่ชอบ เช่น "อยากไปญี่ปุ่น 7 วัน เดือนธันวา ชอบธรรมชาติ"',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [savedTrip, setSavedTrip] = useState<SavedTrip | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [startDate, setStartDate] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Collect all itineraries from bot messages
  const allItineraries = messages
    .filter((m) => m.role === 'bot' && m.itinerary)
    .map((m) => m.itinerary!)

  const latestItinerary = allItineraries.length > 0 ? allItineraries[allItineraries.length - 1] : null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || loading) return

    const userMsg: Message = { role: 'user', content: trimmed }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      })
      const data = await res.json()

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: 'bot', content: 'เกิดข้อผิดพลาดค่ะ กรุณาลองใหม่อีกครั้ง' },
        ])
        return
      }

      const botMsg: Message = {
        role: 'bot',
        content: data.reply ?? '',
        itinerary: data.itinerary ?? null,
        warning: data.warning ?? null,
      }
      setMessages((prev) => [...prev, botMsg])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'bot', content: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ค่ะ' },
      ])
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    if (!latestItinerary) return

    // Guest gate — bounce to sign-in, preserve the itinerary so the user
    // doesn't lose their chat progress when they come back.
    if (!session?.user) {
      try {
        sessionStorage.setItem('pending_itinerary', JSON.stringify(latestItinerary))
      } catch {
        // sessionStorage can fail in private mode — not fatal
      }
      signIn(undefined, { callbackUrl: '/chat' })
      return
    }

    setConfirmLoading(true)

    try {
      const saveRes = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: latestItinerary.title ?? 'แผนการเดินทางญี่ปุ่น',
          itinerary: latestItinerary,
          source: 'chat',
          startDate: startDate || undefined,
        }),
      })
      const saveData = await saveRes.json()

      if (!saveRes.ok) {
        setMessages((prev) => [
          ...prev,
          { role: 'bot', content: 'ไม่สามารถบันทึกแผนได้ค่ะ กรุณาลองใหม่' },
        ])
        return
      }

      const tripId: string = saveData.trip.id
      const primaryCity = latestItinerary.days?.[0]?.location ?? 'JPN'

      const activateRes = await fetch('/api/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId, primaryCity }),
      })
      const activateData = await activateRes.json()

      if (!activateRes.ok) {
        setMessages((prev) => [
          ...prev,
          { role: 'bot', content: 'บันทึกแผนแล้วค่ะ แต่ไม่สามารถสร้างรหัส LINE ได้' },
        ])
        return
      }

      setSavedTrip({ tripId, shareCode: activateData.shareCode })
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'bot', content: 'เกิดข้อผิดพลาดขณะบันทึกแผนค่ะ' },
      ])
    } finally {
      setConfirmLoading(false)
    }
  }

  return (
    <main className="pt-[84px] min-h-screen flex flex-col md:flex-row overflow-hidden bg-briefing-cream">
      {/* Mobile activation banner */}
      {savedTrip && (
        <div className="md:hidden px-6 py-3 bg-basel-brick text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Verified size={14} />
            <span className="text-[10px] font-bold tracking-widest uppercase">CODE: {savedTrip.shareCode}</span>
          </div>
          <button
            className="text-[10px] border border-white px-3 py-1 font-bold uppercase"
            onClick={() => navigator.clipboard.writeText(`/activate ${savedTrip.shareCode}`)}
          >
            Copy
          </button>
        </div>
      )}

      {/* Left Pane: Chat */}
      <section className="flex-1 flex flex-col h-[calc(100vh-84px)] bg-briefing-cream md:border-r border-zen-black/5">
        <div className="px-10 py-8 border-b border-zen-black/5">
          <h1 className="text-3xl font-black text-zen-black font-headline tracking-tighter">AI Concierge</h1>
          <p className="text-zen-black/60 text-xs font-bold uppercase tracking-widest mt-1">dopamichi · Japan Trip Planner</p>
        </div>

        <div className="flex-1 overflow-y-auto px-10 py-8 space-y-10 scrollbar-hide">
          {messages.map((msg, idx) => (
            <div key={idx}>
              {/* Warning banner */}
              {msg.warning && (
                <div className="mb-4 px-4 py-3 border-l-4 border-yellow-400 bg-yellow-50 text-yellow-800 text-sm font-medium">
                  {msg.warning}
                </div>
              )}

              {msg.role === 'bot' ? (
                <div className="flex flex-col items-start max-w-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-basel-brick">Dopamichi Bot</span>
                  </div>
                  <div className="bg-white/50 text-zen-black p-6 border-l-4 border-basel-brick font-medium text-[15px] leading-relaxed shadow-sm whitespace-pre-line">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-zen-black/40">You</span>
                  </div>
                  <div className="bg-zen-black text-briefing-cream p-6 font-medium text-[15px] max-w-md shadow-xl">
                    {msg.content}
                  </div>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex flex-col items-start max-w-xl">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-basel-brick">Dopamichi Bot</span>
              </div>
              <div className="bg-white/50 text-zen-black p-6 border-l-4 border-basel-brick shadow-sm">
                <span className="animate-pulse text-sm font-medium">กำลังวิเคราะห์...</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Chat Input */}
        <div className="p-10 bg-briefing-cream">
          <form onSubmit={handleSubmit}>
            <div className="flex items-center border-b-2 border-zen-black py-2 focus-within:border-basel-brick transition-colors">
              <input
                className="flex-1 bg-transparent border-none outline-none focus:ring-0 text-sm font-medium px-0 placeholder:text-zen-black/30 text-zen-black"
                placeholder="TYPE YOUR REQUEST..."
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="text-zen-black hover:text-basel-brick transition-colors flex items-center p-2 disabled:opacity-40"
              >
                <ChevronRight size={20} strokeWidth={3} />
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Right Pane: Dynamic Itinerary */}
      <section className="w-full md:w-[480px] bg-white/30 flex flex-col h-[calc(100vh-84px)] overflow-hidden">
        {/* Activation Code (Desktop) — hidden until savedTrip set */}
        {savedTrip ? (
          <div className="hidden md:block px-10 py-6 bg-zen-black text-white">
            <div className="flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-[8px] font-black uppercase tracking-[0.4em] opacity-60">Activation Status</span>
                <span className="text-xl font-bold font-headline tracking-tighter">{savedTrip.shareCode}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="px-3 py-1 bg-basel-brick text-[10px] font-black uppercase tracking-widest">Active Itinerary</div>
                <button
                  onClick={() => navigator.clipboard.writeText(`/activate ${savedTrip.shareCode}`)}
                  className="text-[9px] border border-white px-3 py-1.5 font-bold uppercase hover:bg-white hover:text-zen-black transition-all"
                >
                  Copy
                </button>
              </div>
            </div>
            <p className="text-[9px] text-white/50 mt-2 font-medium">
              พิมพ์ /activate {savedTrip.shareCode} ใน LINE เพื่อเริ่มใช้งาน
            </p>
          </div>
        ) : (
          <div className="hidden md:block px-10 py-6 bg-zen-black/5 border-b border-zen-black/5">
            <span className="text-[8px] font-black uppercase tracking-[0.4em] text-zen-black/30">Itinerary Panel</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {allItineraries.length === 0 ? (
            <ItinerarySkeleton />
          ) : (
            <div className="px-10 py-10 space-y-16">
              {allItineraries.map((itin, itinIdx) => (
                <div key={itinIdx}>
                  <div className="flex items-baseline justify-between mb-12 border-b border-zen-black/10 pb-6">
                    <h2 className="text-2xl font-black text-zen-black italic font-headline tracking-tighter">
                      {itin.title ?? 'แผนการเดินทาง'}
                    </h2>
                    <span className="text-[10px] font-black text-basel-brick tracking-widest uppercase">
                      {itin.totalDays ? `${itin.totalDays} วัน` : ''}
                      {itin.season ? ` · ${itin.season}` : ''}
                    </span>
                  </div>
                  <div className="space-y-10">
                    {itin.days.map((day, dayIdx) => (
                      <ItineraryDayItem key={dayIdx} day={day} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom action */}
        <div className="p-8 bg-white/50 border-t border-zen-black/5">
          {savedTrip ? (
            <div className="py-4 bg-zen-black/5 border border-zen-black/10 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-zen-black/50">
                แผนบันทึกแล้ว — ใช้รหัสด้านบนกับ LINE
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <label className="block text-xs font-bold uppercase tracking-widest text-basel-brick mb-1">
                  วันเริ่มเดินทาง (ไม่ระบุก็ได้)
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-briefing-cream border border-zen-black/20 px-4 py-3 font-medium text-sm text-zen-black focus:outline-none focus:border-basel-brick transition-colors"
                />
              </div>
              <button
                onClick={handleConfirm}
                disabled={!latestItinerary || confirmLoading}
                className="w-full py-4 bg-basel-brick text-white font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {confirmLoading ? 'กำลังบันทึก...' : 'Confirm & Sync Itinerary'}
              </button>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
