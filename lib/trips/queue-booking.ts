import type { PlanQueueTime, PlanBookingPolicy } from '@/lib/itinerary-types'

/**
 * The streamlined queueTime × bookingPolicy matrix (15 valid cases) from
 * docs/pre-planned-trip/columns.md → a single UI message + tone for a badge.
 * Keep in sync with that SSOT table.
 */
export type QueueTone = 'ok' | 'warn' | 'heavy' | 'reserve'
export interface QueueBadge { th: string; en: string; tone: QueueTone }

const TONE: Record<PlanQueueTime, QueueTone> = { Low: 'ok', Mid: 'warn', High: 'heavy', Reserve: 'reserve' }

// Message text WITHOUT the leading emoji (the badge adds an icon by tone).
const MATRIX: Record<string, { th: string; en: string }> = {
  'Low|Walk-in Only': { th: 'เข้าใช้บริการได้สะดวก (รับเฉพาะ Walk-in)', en: 'Easy to walk in (Walk-in only)' },
  'Low|Same-Day Ticket': { th: 'เข้าใช้บริการได้สะดวก (รับคิวหน้าร้าน/แอป)', en: 'Easy to walk in (Queue via app/onsite)' },
  'Low|Optional': { th: 'เข้าใช้บริการได้สะดวก (มีตัวเลือกจองโต๊ะล่วงหน้า)', en: 'Easy to walk in (Advance booking optional)' },
  'Low|Recommended': { th: 'เข้าใช้บริการได้สะดวก (แนะนำให้จองล่วงหน้า)', en: 'Easy to walk in (Advance booking recommended)' },
  'Mid|Walk-in Only': { th: 'คิวปานกลาง: มักมีคิวช่วงมื้ออาหาร เผื่อเวลารอคิว (รับเฉพาะ Walk-in)', en: 'Moderate queue: expect peak-hour lines (Walk-in only)' },
  'Mid|Same-Day Ticket': { th: 'คิวปานกลาง: มักมีคิวช่วงมื้ออาหาร เผื่อเวลารอคิว (รับคิวหน้าร้าน/แอป)', en: 'Moderate queue: expect peak-hour lines (Queue via app/onsite)' },
  'Mid|Optional': { th: 'คิวปานกลาง: มักมีคิวช่วงมื้ออาหาร เผื่อเวลารอคิว (จองโต๊ะล่วงหน้าได้)', en: 'Moderate queue: expect peak-hour lines (Advance booking optional)' },
  'Mid|Recommended': { th: 'คิวปานกลาง: มักมีคิวช่วงมื้ออาหาร เผื่อเวลารอคิว (แนะนำให้จองล่วงหน้า)', en: 'Moderate queue: expect peak-hour lines (Advance booking recommended)' },
  'High|Walk-in Only': { th: 'คิวหนาแน่นมาก: ร้านดังยอดฮิต เผื่อเวลารอคิวเยอะ ๆ (รับเฉพาะ Walk-in)', en: 'Heavy crowds: popular hotspot, long queues (Walk-in only)' },
  'High|Same-Day Ticket': { th: 'คิวหนาแน่นมาก: ร้านดังยอดฮิต เผื่อเวลารอคิวเยอะ ๆ (รับคิวหน้าร้าน/แอป)', en: 'Heavy crowds: popular hotspot, long queues (Queue via app/onsite)' },
  'High|Optional': { th: 'คิวหนาแน่นมาก: ร้านดังยอดฮิต เผื่อเวลารอคิวเยอะ ๆ (จองโต๊ะล่วงหน้าได้)', en: 'Heavy crowds: popular hotspot, long queues (Advance booking optional)' },
  'High|Recommended': { th: 'คิวหนาแน่นมาก: ร้านดังยอดฮิต เผื่อเวลารอคิวเยอะ ๆ (แนะนำจองล่วงหน้าเพื่อข้ามคิว)', en: 'Heavy crowds: popular hotspot, long queues (Book ahead to skip the line)' },
  'Reserve|Optional': { th: 'เปิดให้จองล่วงหน้า (Walk-in มีจำนวนจำกัด)', en: 'Advance booking available (Walk-in is highly limited)' },
  'Reserve|Recommended': { th: 'แนะนำให้จองล่วงหน้า (Walk-in เสี่ยงไม่ได้โต๊ะ)', en: 'Advance booking recommended (High risk of no walk-in tables)' },
  'Reserve|Mandatory': { th: 'ต้องจองล่วงหน้าเท่านั้น: ไม่รับ Walk-in', en: 'Booking strictly required: no walk-ins accepted' },
}

/** The queue × booking UI message. Returns null if there's no queue info or the
 *  pair isn't one of the 15 valid cases. Low/Mid/High default a missing booking
 *  policy to Walk-in Only; Reserve needs an explicit policy. */
export function queueBookingBadge(queue?: PlanQueueTime | null, booking?: PlanBookingPolicy | null): QueueBadge | null {
  if (!queue) return null
  const b = booking ?? (queue === 'Reserve' ? null : 'Walk-in Only')
  if (!b) return null
  const hit = MATRIX[`${queue}|${b}`]
  return hit ? { ...hit, tone: TONE[queue] } : null
}
