import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, CalendarCheck } from 'lucide-react'
import { queueBookingBadge, type QueueTone } from '@/lib/trips/queue-booking'
import type { PlanQueueTime, PlanBookingPolicy } from '@/lib/itinerary-types'

const TONE: Record<QueueTone, { box: string; boxDark: string; icon: ReactNode }> = {
  ok: { box: 'bg-emerald-50 text-emerald-800 border-emerald-200', boxDark: 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20', icon: <CheckCircle2 size={12} strokeWidth={2.5} /> },
  warn: { box: 'bg-amber-50 text-amber-900 border-amber-200', boxDark: 'bg-amber-500/10 text-amber-200 border-amber-500/20', icon: <AlertTriangle size={12} strokeWidth={2.5} /> },
  heavy: { box: 'bg-red-50 text-red-800 border-red-200', boxDark: 'bg-red-500/10 text-red-200 border-red-500/20', icon: <AlertTriangle size={12} strokeWidth={2.5} /> },
  reserve: { box: 'bg-blue-50 text-blue-800 border-blue-200', boxDark: 'bg-blue-500/10 text-blue-200 border-blue-500/20', icon: <CalendarCheck size={12} strokeWidth={2.5} /> },
}

/** The queue × booking status pill (15-case matrix). Renders nothing if there's
 *  no valid queue/booking pair. Shared by the timeline cards + the meal carousel. */
export default function QueueBookingBadge({ queue, booking, howToBook, variant = 'light' }: {
  queue?: PlanQueueTime | null
  booking?: PlanBookingPolicy | null
  howToBook?: string
  variant?: 'light' | 'dark'
}) {
  const badge = queueBookingBadge(queue, booking)
  if (!badge) return null
  const tone = TONE[badge.tone]
  return (
    <div className={`flex items-start gap-1.5 text-[11px] leading-relaxed rounded-lg border px-2.5 py-1.5 mt-1.5 ${variant === 'dark' ? tone.boxDark : tone.box}`}>
      <span className="flex-shrink-0 mt-0.5">{tone.icon}</span>
      <span className="flex-1">
        {badge.th}
        {howToBook && <span className="block opacity-80 mt-0.5">วิธีจอง: {howToBook}</span>}
      </span>
    </div>
  )
}
