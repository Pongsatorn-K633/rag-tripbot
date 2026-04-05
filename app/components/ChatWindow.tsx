'use client'

import { useState, useEffect, useRef, FormEvent } from 'react'
import MessageBubble from './MessageBubble'
import ItineraryCard from './ItineraryCard'
import ActivationBanner from './ActivationBanner'

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

function getUserId(): string {
  if (typeof window === 'undefined') return ''
  const stored = localStorage.getItem('tripbot_user_id')
  if (stored) return stored
  const newId = crypto.randomUUID()
  localStorage.setItem('tripbot_user_id', newId)
  return newId
}

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'bot',
      content:
        'สวัสดีค่ะ! ฉันคือ RAG TripBot ผู้ช่วยวางแผนเที่ยวญี่ปุ่นสำหรับคนไทยค่ะ\nบอกฉันได้เลยว่าอยากไปเดือนไหน กี่วัน และสไตล์การเดินทางที่ชอบ เช่น "อยากไปญี่ปุ่น 7 วัน เดือนธันวา ชอบธรรมชาติ"',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [savedTrip, setSavedTrip] = useState<SavedTrip | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

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

  async function handleConfirm(itinerary: Itinerary) {
    setConfirmLoading(true)
    const userId = getUserId()

    try {
      // Save trip
      const saveRes = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          title: itinerary.title ?? 'แผนการเดินทางญี่ปุ่น',
          itinerary,
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

      // Determine primary city from first day
      const primaryCity =
        itinerary.days?.[0]?.location ?? 'JPN'

      // Get activation code
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
    <div className="flex flex-col h-screen" style={{ backgroundColor: '#f3f4f6' }}>
      {/* Top bar */}
      <header
        className="flex items-center gap-3 px-5 py-4 shadow-sm flex-shrink-0"
        style={{ backgroundColor: '#1a2744' }}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
          style={{ backgroundColor: '#c9a84c', color: '#1a2744' }}
        >
          RT
        </div>
        <div>
          <p className="font-semibold text-sm" style={{ color: '#ffffff' }}>
            RAG TripBot
          </p>
          <p className="text-xs" style={{ color: '#c9a84c' }}>
            ผู้ช่วยวางแผนเที่ยวญี่ปุ่น
          </p>
        </div>
      </header>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.map((msg, idx) => (
          <div key={idx}>
            {/* Warning banner */}
            {msg.warning && (
              <div
                className="rounded-lg px-4 py-2 mb-2 text-sm"
                style={{
                  backgroundColor: '#fef9c3',
                  border: '1px solid #fde047',
                  color: '#854d0e',
                }}
              >
                {msg.warning}
              </div>
            )}

            <MessageBubble role={msg.role} content={msg.content} />

            {/* Itinerary card attached to this message */}
            {msg.itinerary && !savedTrip && (
              <ItineraryCard
                itinerary={msg.itinerary}
                onConfirm={() => handleConfirm(msg.itinerary!)}
                confirmLoading={confirmLoading}
              />
            )}

            {/* Show saved itinerary without confirm button */}
            {msg.itinerary && savedTrip && (
              <ItineraryCard
                itinerary={msg.itinerary}
                onConfirm={() => {}}
                confirmLoading={false}
              />
            )}
          </div>
        ))}

        {/* Activation banner — shown once after save */}
        {savedTrip && (
          <ActivationBanner shareCode={savedTrip.shareCode} />
        )}

        {/* Loading indicator */}
        {loading && (
          <div className="flex justify-start mb-3">
            <div
              className="rounded-2xl px-4 py-3 text-sm"
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                color: '#1a2744',
              }}
            >
              <span className="animate-pulse">กำลังคิด...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <form
        onSubmit={handleSubmit}
        className="flex-shrink-0 px-4 py-3 flex gap-2"
        style={{ backgroundColor: '#ffffff', borderTop: '1px solid #e5e7eb' }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          placeholder="พิมพ์ข้อความของคุณที่นี่..."
          className="flex-1 rounded-full px-4 py-2 text-sm outline-none disabled:opacity-60"
          style={{
            backgroundColor: '#f3f4f6',
            color: '#1a2744',
            border: '1px solid #e5e7eb',
          }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-full px-5 py-2 text-sm font-semibold transition-opacity disabled:opacity-50"
          style={{ backgroundColor: '#1a2744', color: '#c9a84c' }}
        >
          ส่ง
        </button>
      </form>
    </div>
  )
}
