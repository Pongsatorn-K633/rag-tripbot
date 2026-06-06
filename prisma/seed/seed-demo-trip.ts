/**
 * Seed a demo v2 trip — a 4-day Kyoto itinerary that interleaves Logistics nodes
 * (train / bus / walking routes, incl. a Uji matcha-street walk) in the timeline.
 * Builds the library nodes too. Idempotent: reuses nodes by name and REPLACES any
 * prior demo template (so re-running updates it).
 *
 *   npx tsx prisma/seed/seed-demo-trip.ts
 */
import 'dotenv/config'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../lib/db/index.js'
import { generateShareCodeForTemplate, getSystemUserId } from '../../lib/share-code.js'
import type { ItineraryV2, DayV2, NodeSnap, Slot, ActivityPriority } from '../../lib/itinerary-types.js'

const DEMO_TITLE = 'Kyoto 4-Day Classic (Demo)'

type NodeSeed = {
  name: string; nameTh: string; categoryCode: string
  notes?: string; cost?: string; duration?: string; city?: string; mapUrl?: string; placeId?: string
}

const NODES: NodeSeed[] = [
  // ── Cafes / food ──────────────────────────────────────────────────────────
  { name: '% Arabica Kyoto', nameTh: 'อาราบิก้า เกียวโต', categoryCode: 'food.cafe.cafe', notes: 'กาแฟวิวแม่น้ำ', cost: '¥600', duration: '30min', city: 'Kyoto' },
  { name: '% Arabica Arashiyama', nameTh: 'อาราบิก้า อาราชิยามะ', categoryCode: 'food.cafe.cafe', notes: 'สาขาริมแม่น้ำโออิ', cost: '¥600', duration: '30min', city: 'Kyoto' },
  { name: 'Menbaka Fire Ramen', nameTh: 'ราเมนไฟลุก', categoryCode: 'food.dine.ramen', notes: 'ราเมนโชว์ไฟ', cost: '¥1,250', duration: '45min', city: 'Kyoto' },
  { name: 'Okutan Yudofu', nameTh: 'เต้าหู้ต้มโอคุตัน', categoryCode: 'food.dine.restaurant', notes: 'ยูโดฟุ (เต้าหู้ต้ม) แบบเกียวโต', cost: '¥3,500', duration: '1h', city: 'Kyoto' },
  { name: 'Omen Ginkakuji', nameTh: 'อุด้งโอเม็ง', categoryCode: 'food.dine.ramen', notes: 'อุด้งใกล้กินคะคุจิ', cost: '¥1,300', duration: '45min', city: 'Kyoto' },
  { name: 'Nakamura Tokichi Honten', nameTh: 'นาคามูระ โทคิจิ', categoryCode: 'food.cafe.sweets', notes: 'ของหวานชาเขียวอุจิ ร้านดัง', cost: '¥1,400', duration: '1h', city: 'Uji' },
  { name: 'Uji Cha Soba', nameTh: 'โซบะชาเขียวอุจิ', categoryCode: 'food.dine.ramen', notes: 'โซบะผสมชาเขียว', cost: '¥1,200', duration: '45min', city: 'Uji' },
  { name: 'Pontocho Izakaya', nameTh: 'อิซากายะปงโตโจ', categoryCode: 'food.dine.izakaya', notes: 'ตรอกริมแม่น้ำคาโมะ', cost: '¥4,000', duration: '1.5h', city: 'Kyoto' },
  { name: 'Kikunoi Honten', nameTh: 'ไคเซกิ คิคุโนะอิ', categoryCode: 'food.dine.kaiseki', notes: 'ไคเซกิมิชลิน จองล่วงหน้า', cost: '¥15,000', duration: '2h', city: 'Kyoto' },
  { name: 'Nishiki Market Street Food', nameTh: 'สตรีทฟู้ดตลาดนิชิกิ', categoryCode: 'food.dine.street', notes: 'ชิมของกินตลอดตลาด', cost: '¥1,500', duration: '1h', city: 'Kyoto' },

  // ── Experiences / landmarks ───────────────────────────────────────────────
  { name: 'Fushimi Inari Taisha', nameTh: 'ศาลเจ้าฟูชิมิอินาริ', categoryCode: 'exp.land.temple', notes: 'พันเสาโทริอิสีแดง', cost: 'Free', duration: '2h', city: 'Kyoto', mapUrl: 'https://maps.app.goo.gl/4FYfT7wdATmLYWwW9', placeId: 'ChIJIW0uPRUPAWAR6eI6dRzKGns' },
  { name: 'Kiyomizu-dera', nameTh: 'วัดคิโยมิซุ', categoryCode: 'exp.land.temple', notes: 'ระเบียงไม้ + วิวเมือง', cost: '¥400', duration: '1.5h', city: 'Kyoto' },
  { name: 'Sannenzaka & Ninenzaka', nameTh: 'ถนนซันเนนซากะ', categoryCode: 'shop.shotengai', notes: 'ถนนโบราณ ร้านขนม/ของฝาก', cost: 'Free', duration: '1h', city: 'Kyoto' },
  { name: 'Gion District', nameTh: 'ย่านกิออน', categoryCode: 'exp.act.strolling', notes: 'ย่านเกอิชา ตอนเย็นบรรยากาศดี', cost: 'Free', duration: '1h', city: 'Kyoto' },
  { name: 'Ginkaku-ji', nameTh: 'วัดเงิน กินคะคุจิ', categoryCode: 'exp.land.temple', notes: 'ศาลาเงิน + สวนทราย', cost: '¥500', duration: '1h', city: 'Kyoto' },
  { name: "Philosopher's Path", nameTh: 'เส้นทางนักปรัชญา', categoryCode: 'exp.act.strolling', notes: 'ซากุระริมคลอง 2 กม.', cost: 'Free', duration: '1h', city: 'Kyoto' },
  { name: 'Nanzen-ji Temple Complex', nameTh: 'วัดนันเซนจิ', categoryCode: 'exp.land.temple', notes: 'วัดเซน + ท่อส่งน้ำอิฐ', cost: '¥600', duration: '1h', city: 'Kyoto' },
  { name: 'Arashiyama Bamboo Grove', nameTh: 'ป่าไผ่อาราชิยามะ', categoryCode: 'exp.land.nature', notes: 'ไปเช้าคนน้อย', cost: 'Free', duration: '45min', city: 'Kyoto' },
  { name: 'Tenryu-ji Temple', nameTh: 'วัดเทนริวจิ', categoryCode: 'exp.land.temple', notes: 'สวนเซนมรดกโลก', cost: '¥500', duration: '1h', city: 'Kyoto' },
  { name: 'Togetsukyo Bridge', nameTh: 'สะพานโทเง็ตสึเคียว', categoryCode: 'exp.land.nature', notes: 'สะพานข้ามแม่น้ำโออิ', cost: 'Free', duration: '20min', city: 'Kyoto' },
  { name: 'Byodo-in Temple', nameTh: 'วัดเบียวโดอิน', categoryCode: 'exp.land.temple', notes: 'วัดบนเหรียญ 10 เยน', cost: '¥600', duration: '1h', city: 'Uji' },
  { name: 'Tsuen Tea Shop', nameTh: 'ร้านชาสึเอ็น', categoryCode: 'shop.souvenir', notes: 'ร้านชาเก่าแก่ที่สุดในญี่ปุ่น', cost: 'Free', duration: '30min', city: 'Uji' },
  { name: 'Nishiki Market', nameTh: 'ตลาดนิชิกิ', categoryCode: 'shop.market', notes: 'ครัวของเกียวโต', cost: 'Free', duration: '1.5h', city: 'Kyoto' },
  { name: 'Nijo Castle', nameTh: 'ปราสาทนิโจ', categoryCode: 'exp.land.castle', notes: 'พื้นไม้ร้องเพลง (nightingale floor)', cost: '¥1,300', duration: '1.5h', city: 'Kyoto' },

  // ── Logistics ─────────────────────────────────────────────────────────────
  { name: 'JR Nara Line', nameTh: 'รถไฟสาย JR นารา', categoryCode: 'log.rail.jr', notes: 'Inari → Kyoto Station', cost: '¥150', duration: '5min' },
  { name: 'Kyoto City Bus 100', nameTh: 'รถบัสเมืองสาย 100', categoryCode: 'log.road.citybus', notes: 'Kyoto Station → Kiyomizu', cost: '¥230', duration: '15min' },
  { name: 'Walk · Higashiyama lanes', nameTh: 'เดินตรอกฮิงาชิยามะ', categoryCode: 'log.active.walk', notes: 'เดินจาก Kiyomizu ลง Sannenzaka → Gion', cost: 'Free', duration: '25min' },
  { name: 'Walk along the canal', nameTh: 'เดินเลียบคลอง', categoryCode: 'log.active.walk', notes: "เดินต่อจาก Philosopher's Path → Nanzen-ji", cost: 'Free', duration: '10min' },
  { name: 'JR Sagano Line', nameTh: 'รถไฟสาย JR ซากาโนะ', categoryCode: 'log.rail.jr', notes: 'Kyoto → Saga-Arashiyama (15 นาที)', cost: '¥240', duration: '15min' },
  { name: 'JR to Uji', nameTh: 'รถไฟ JR ไปอุจิ', categoryCode: 'log.rail.jr', notes: 'Kyoto → Uji (สาย Nara, ~20 นาที)', cost: '¥240', duration: '20min' },
  { name: 'Walk · Byodoin Omotesando (matcha street)', nameTh: 'เดินถนนชาเขียวหน้าวัดเบียวโดอิน', categoryCode: 'log.active.walk', notes: 'เดินชิมชาเขียวร้านต่างๆ ระหว่างทาง', cost: 'Free', duration: '20min', mapUrl: 'https://www.google.com/maps/dir/?api=1&origin=Byodoin+Temple+Uji&destination=Nakamura+Tokichi+Honten+Uji&travelmode=walking' },
  { name: 'Taxi', nameTh: 'แท็กซี่', categoryCode: 'log.hire.taxi', notes: 'สั้นๆ ตอนเหนื่อย', cost: '¥1,000', duration: '10min' },

  // ── Stay ──────────────────────────────────────────────────────────────────
  { name: 'The Ritz-Carlton Kyoto', nameTh: 'ริทซ์ คาร์ลตัน เกียวโต', categoryCode: 'live.stay.hotel', notes: 'ริมแม่น้ำคาโมะ (พักทุกคืน)', cost: '¥80,000/คืน', city: 'Kyoto' },
]

async function main() {
  const systemUserId = await getSystemUserId()
  const cats = await prisma.category.findMany({ select: { code: true, emoji: true } })
  const emojiOf = (code: string) => cats.find((c) => c.code === code)?.emoji ?? null

  // Replace any prior demo (+ its bridge trips)
  for (const o of await prisma.template.findMany({ where: { title: { contains: 'Demo' } } })) {
    await prisma.trip.deleteMany({ where: { templateId: o.id } })
    await prisma.template.delete({ where: { id: o.id } })
  }

  // Library nodes (reuse by name)
  const byName: Record<string, { id: string } & NodeSeed> = {}
  for (const n of NODES) {
    const existing = await prisma.node.findFirst({ where: { name: n.name } })
    const node = existing
      ? await prisma.node.update({ where: { id: existing.id }, data: { ...n, createdById: systemUserId } })
      : await prisma.node.create({ data: { ...n, createdById: systemUserId } })
    byName[n.name] = { ...n, id: node.id }
  }

  const snap = (name: string, time?: string): NodeSnap => {
    const n = byName[name]
    return {
      nodeId: n.id, name: n.name, nameTh: n.nameTh, categoryCode: n.categoryCode,
      emoji: emojiOf(n.categoryCode), notes: n.notes ?? null, cost: n.cost ?? null,
      duration: n.duration ?? null, time: time ?? null, mapUrl: n.mapUrl ?? null, placeId: n.placeId ?? null,
    }
  }
  const single = (name: string, time?: string): Slot => ({ kind: 'single', node: snap(name, time) })
  // Pick-one meal/stay slot — renders as the swipeable restaurant-choice carousel.
  // selected=null → no option pre-picked (a template shouldn't default a choice).
  const choice = (label: string, names: string[], selected: number | null = null): Slot =>
    ({ kind: 'choice', label, selected, options: names.map((n) => snap(n)) })
  const act = (name: string, time: string, priority?: ActivityPriority) => ({ time, priority, node: snap(name) })

  // A meal can be a quick [name, time] single, or a full Slot (e.g. a choice).
  type MealInput = [string, string] | Slot
  const mealSlot = (m?: MealInput): Slot | null =>
    !m ? null : Array.isArray(m) ? single(m[0], m[1]) : m

  const day = (
    n: number, location: string,
    meals: { b?: MealInput; l?: MealInput; d?: MealInput },
    activities: DayV2['activities'],
  ): DayV2 => ({
    day: n, location, free: false,
    meals: { breakfast: mealSlot(meals.b), lunch: mealSlot(meals.l), dinner: mealSlot(meals.d) },
    activities,
    accommodation: single('The Ritz-Carlton Kyoto'),
    transport: [],
  })

  const days: DayV2[] = [
    day(1, 'Higashiyama (South)', { b: ['% Arabica Kyoto', '08:00'], l: ['Menbaka Fire Ramen', '12:30'], d: choice('อาหารเย็น · เลือก 1 ร้าน (Dinner)', ['Kikunoi Honten', 'Pontocho Izakaya', 'Nishiki Market Street Food']) }, [
      act('Fushimi Inari Taisha', '09:00', 'recommended'),
      act('Kyoto City Bus 100', '11:00'),
      act('Kiyomizu-dera', '11:45', 'recommended'),
      act('Sannenzaka & Ninenzaka', '14:00', 'recommended'),
      act('Walk · Higashiyama lanes', '15:30'),
      act('Gion District', '16:30', 'recommended'),
    ]),
    day(2, 'Higashiyama (North)', { b: ['% Arabica Kyoto', '08:00'], l: ['Omen Ginkakuji', '12:30'], d: ['Pontocho Izakaya', '19:00'] }, [
      act('Ginkaku-ji', '09:00', 'recommended'),
      act("Philosopher's Path", '10:30', 'recommended'),
      act('Walk along the canal', '11:45'),
      act('Nanzen-ji Temple Complex', '12:00', 'recommended'),
    ]),
    day(3, 'Arashiyama', { b: ['% Arabica Arashiyama', '08:00'], l: ['Okutan Yudofu', '12:30'], d: ['Nishiki Market Street Food', '18:30'] }, [
      act('JR Sagano Line', '08:30'),
      act('Arashiyama Bamboo Grove', '09:00', 'recommended'),
      act('Tenryu-ji Temple', '09:50', 'recommended'),
      act('Togetsukyo Bridge', '11:00', 'optional'),
    ]),
    day(4, 'Uji day trip', { b: ['% Arabica Kyoto', '08:00'], l: ['Uji Cha Soba', '12:30'], d: ['Nishiki Market Street Food', '18:30'] }, [
      act('JR to Uji', '09:00'),
      act('Byodo-in Temple', '09:45', 'recommended'),
      act('Walk · Byodoin Omotesando (matcha street)', '11:00'),
      act('Nakamura Tokichi Honten', '11:20', 'recommended'),
      act('Tsuen Tea Shop', '14:00', 'optional'),
      act('JR to Uji', '16:00'), // return leg
    ]),
  ]

  const itinerary: ItineraryV2 = {
    version: 2, title: DEMO_TITLE, totalDays: 4, season: 'Spring',
    description: 'เดโม่ 4 วันเกียวโต — โหนด logistics (รถไฟ/บัส/เดิน) แทรกในไทม์ไลน์ + วันอุจิเดินชิมชาเขียว',
    airports: ['KIX'], // Kyoto = Kansai international gateway (ITM is domestic-only)
    days,
  }

  const template = await prisma.template.create({
    data: {
      title: DEMO_TITLE, description: itinerary.description, totalDays: 4, season: 'Spring',
      itinerary: itinerary as unknown as Prisma.InputJsonValue,
      availability: { available: [], recommended: [{ from: '03-25', to: '04-15' }] } as unknown as Prisma.InputJsonValue,
      published: true, createdById: systemUserId,
    },
  })
  const code = await generateShareCodeForTemplate(template.id, systemUserId, 'KYO')

  const logistics = NODES.filter((n) => n.categoryCode.startsWith('log.')).length
  console.log(`Created "${DEMO_TITLE}" → ${code} · 4 days · ${NODES.length} library nodes (${logistics} logistics)`)
}

main()
  .catch((e) => { console.error('Demo seed failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
