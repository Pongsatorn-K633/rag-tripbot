'use client'

import { useState } from 'react'
import { ChevronDown, MapPin, Hotel, Train, Clock, AlertTriangle, Star, Circle, Banknote, Timer } from 'lucide-react'
import type { Itinerary, Day, Activity, ActivityPriority } from '@/lib/itinerary-types'
import { PRIORITY_LABEL } from '@/lib/itinerary-types'
import CategoryIcon from '@/app/components/CategoryIcon'
import ChoiceCarousel from '@/app/components/ChoiceCarousel'

/**
 * Itinerary preview card — white-themed version of the LIFF itinerary view.
 *
 * Supports the enhanced data model:
 *   - priority badges (mandatory / recommended / optional)
 *   - category emoji badges
 *   - choice groups (pick one of N alternatives)
 *   - accommodation choices (budget / mid / luxury tiers)
 *   - cost + duration hints
 */

interface ItineraryCardProps {
  itinerary: Itinerary
  onConfirm: () => void
  confirmLoading?: boolean
}

export default function ItineraryCard({
  itinerary,
  onConfirm,
  confirmLoading = false,
}: ItineraryCardProps) {
  const [openDay, setOpenDay] = useState<number | null>(1)
  const totalDays = itinerary.totalDays ?? itinerary.days.length
  const currentOpenDay = openDay ?? 1

  return (
    <div className="rounded-xl overflow-hidden border border-zen-black/10 bg-white shadow-sm">
      {/* Header */}
      <div className="px-4 sm:px-6 py-5 bg-zen-black">
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-4">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-basel-brick mb-1">
              Travel Dossier
            </p>
            <h2 className="font-headline font-extrabold text-xl tracking-tight text-briefing-cream leading-tight">
              {itinerary.title ?? 'แผนการเดินทาง'}
            </h2>
          </div>
          <p className="text-xs font-bold text-briefing-cream/60 flex-shrink-0">
            {totalDays} วัน{itinerary.season ? ` · ${itinerary.season}` : ''}
          </p>
        </div>
      </div>

      {/* Journey header */}
      <div className="flex items-baseline justify-between px-4 sm:px-6 py-4 border-b border-zen-black/5">
        <h3 className="font-headline text-lg font-extrabold text-zen-black">The Journey</h3>
        <span className="text-[10px] font-bold text-basel-brick uppercase tracking-widest">
          Day {currentOpenDay} / {totalDays}
        </span>
      </div>

      {/* Day accordion */}
      <div className="divide-y divide-zen-black/5">
        {itinerary.days.map((day) => (
          <DayPanel
            key={day.day}
            day={day}
            isOpen={openDay === day.day}
            onToggle={() => setOpenDay(openDay === day.day ? null : day.day)}
          />
        ))}
      </div>

      {/* Confirm button */}
      <div className="px-4 sm:px-6 py-4 bg-white border-t border-zen-black/10 space-y-3">
        <button
          onClick={onConfirm}
          disabled={confirmLoading}
          className="w-full py-4 bg-basel-brick text-white font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black transition-all disabled:opacity-50"
        >
          {confirmLoading ? 'กำลังบันทึก...' : 'Confirm & Sync Itinerary'}
        </button>
        <p className="text-[15px] text-zen-black/50 text-center leading-relaxed">
          สามารถทำการ edit ทริปตามความต้องการเพิ่มเติมได้หลังกด confirm
        </p>
      </div>
    </div>
  )
}

// ── Day Panel ───────────────────────────────────────────────────────────────

function DayPanel({ day, isOpen, onToggle }: { day: Day; isOpen: boolean; onToggle: () => void }) {
  const paddedDay = String(day.day).padStart(2, '0')
  const mandatoryCount = day.activities.filter((a) => a.priority === 'mandatory').length
  const choiceCount = day.choices?.length ?? 0

  return (
    <div>
      <button
        className="w-full text-left px-4 sm:px-6 py-4 flex items-center gap-3 sm:gap-4 hover:bg-briefing-cream/50 transition-colors"
        onClick={onToggle}
      >
        <span
          className={[
            'inline-flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-xl font-black text-sm sm:text-lg flex-shrink-0 transition-colors',
            isOpen ? 'bg-basel-brick text-white' : 'bg-zen-black/5 text-zen-black/40',
          ].join(' ')}
        >
          {paddedDay}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base sm:text-lg text-zen-black leading-tight truncate">{day.location}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
            <span className="text-[10px] sm:text-xs text-zen-black/40 font-medium flex items-center gap-1">
              <MapPin size={10} strokeWidth={2.5} />
              Day {day.day} · {day.activities.length} กิจกรรม
            </span>
            {mandatoryCount > 0 && (
              <span className="text-[10px] text-basel-brick font-medium flex items-center gap-0.5">
                <AlertTriangle size={10} strokeWidth={2.5} />
                {mandatoryCount} must-do
              </span>
            )}
            {choiceCount > 0 && (
              <span className="text-[10px] text-blue-600 font-medium flex items-center gap-0.5">
                <Star size={10} strokeWidth={2.5} />
                {choiceCount} choice{choiceCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <ChevronDown
          size={18}
          className={[
            'flex-shrink-0 transition-all duration-200',
            isOpen ? 'rotate-180 text-basel-brick' : 'rotate-0 text-zen-black/20',
          ].join(' ')}
        />
      </button>

      {isOpen && (
        <div className="px-4 sm:px-6 pb-6 pt-2 space-y-6 border-t border-zen-black/5 bg-briefing-cream/30">
          {/* Activities timeline */}
          {day.activities.length > 0 && (
            <div className="space-y-5">
              {day.activities.map((act, idx) => (
                <ActivityItem key={idx} activity={act} />
              ))}
            </div>
          )}

          {/* Choices */}
          {day.choices && day.choices.length > 0 && (
            <div className="space-y-4">
              {day.choices.map((choice, idx) => (
                <ChoiceCarousel key={idx} choice={choice} />
              ))}
            </div>
          )}

          {/* Accommodation */}
          {(day.accommodation || (day.accommodationChoices && day.accommodationChoices.length > 0)) && (
            <div className="flex items-start gap-2">
              <Hotel size={14} className="text-basel-brick flex-shrink-0 mt-0.5" strokeWidth={2.5} />
              <div className="flex-1">
                <p className="text-[10px] font-bold text-basel-brick uppercase tracking-widest mb-1">ที่พัก</p>
                {day.accommodation && (
                  <p className="text-sm text-zen-black leading-relaxed">{day.accommodation}</p>
                )}
                {day.accommodationChoices && day.accommodationChoices.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    <p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest">
                      ตัวเลือก · Options
                    </p>
                    {day.accommodationChoices.map((opt, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-sm text-zen-black/70 bg-white px-3 py-2 border border-zen-black/10 rounded"
                      >
                        <Circle size={8} className="text-blue-500 flex-shrink-0" fill="currentColor" />
                        <span className="font-medium">{opt.name}</span>
                        {opt.tier && (
                          <span className="text-[9px] font-bold uppercase tracking-widest text-zen-black/40">
                            {opt.tier}
                          </span>
                        )}
                        {opt.cost && (
                          <span className="ml-auto text-xs text-basel-brick font-bold">{opt.cost}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Transport */}
          {day.transport && (
            <div className="flex items-start gap-2">
              <Train size={14} className="text-basel-brick flex-shrink-0 mt-0.5" strokeWidth={2.5} />
              <div>
                <p className="text-[10px] font-bold text-basel-brick uppercase tracking-widest mb-1">การเดินทาง</p>
                <p className="text-sm text-zen-black leading-relaxed">{day.transport}</p>
                {day.transportNotes && (
                  <p className="text-xs text-zen-black/50 mt-1 italic">{day.transportNotes}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Activity Item ───────────────────────────────────────────────────────────

function ActivityItem({ activity }: { activity: Activity }) {
  const priority = activity.priority ?? 'optional'
  const category = activity.category

  return (
    <div className={`relative pl-7 border-l-[3px] ${priorityBorderColor(priority)}`}>
      <span className={`absolute -left-[6px] top-0.5 w-2.5 h-2.5 rounded-full ${priorityDotColor(priority)}`} />
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-[10px] font-bold text-basel-brick uppercase tracking-widest flex items-center gap-1">
          <Clock size={10} strokeWidth={2.5} />
          {activity.time}
        </p>
        {priority === 'mandatory' && (
          <span className="text-[8px] font-black uppercase tracking-widest bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
            {PRIORITY_LABEL.mandatory}
          </span>
        )}
        {priority === 'recommended' && (
          <span className="text-[8px] font-black uppercase tracking-widest bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
            {PRIORITY_LABEL.recommended}
          </span>
        )}
        {category && (
          <span className="text-[9px]" title={category}>
            <CategoryIcon category={category} size={12} className="text-zen-black/50" />
          </span>
        )}
      </div>
      <p className="font-bold text-base text-zen-black mt-1">{activity.name}</p>
      {activity.notes && (
        <p className="text-sm text-zen-black/60 mt-1.5 leading-relaxed">{activity.notes}</p>
      )}
      {(activity.cost || activity.duration) && (
        <div className="flex gap-3 mt-1.5">
          {activity.cost && (
            <span className="text-[10px] font-bold text-zen-black/50 flex items-center gap-0.5"><Banknote size={10} strokeWidth={2} /> {activity.cost}</span>
          )}
          {activity.duration && (
            <span className="text-[10px] font-bold text-zen-black/50 flex items-center gap-0.5"><Timer size={10} strokeWidth={2} /> {activity.duration}</span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Priority color helpers ──────────────────────────────────────────────────

function priorityBorderColor(p: ActivityPriority): string {
  switch (p) {
    case 'mandatory': return 'border-red-500'
    case 'recommended': return 'border-amber-400'
    default: return 'border-basel-brick'
  }
}

function priorityDotColor(p: ActivityPriority): string {
  switch (p) {
    case 'mandatory': return 'bg-red-500'
    case 'recommended': return 'bg-amber-400'
    default: return 'bg-basel-brick'
  }
}
