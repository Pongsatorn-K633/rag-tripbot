/**
 * Seed 3 MOCK pre-planned trips (Hokkaido / Fukuoka / Osaka) so the home
 * coverflow has enough cards to fan properly. Invented content — real trips are
 * authored on the admin dashboard.
 *
 *   npx tsx scripts/seed-mock-trips.ts              # dev branch
 *   npx tsx scripts/seed-mock-trips.ts --remove     # delete them again
 *   USE_PROD_DB=1 npx tsx scripts/seed-mock-trips.ts [--remove]
 *
 * Idempotent by `source_file`, exactly like import-dopamichi: re-running
 * UPDATES the same rows rather than duplicating, and --remove takes them out
 * cleanly (they're mock content, so deleting is the intended end state).
 *
 * The JSON below is the normal authoring shape and goes through importPlanJson,
 * so these rows are validated and normalised identically to real content.
 */
import './load-env.js'
import type { Prisma } from '@prisma/client'
import { prisma } from '../lib/db/index.js'
import { generateShareCodeForTemplate, getSystemUserId } from '../lib/share-code.js'
import { importPlanJson, deriveAvailability } from '../lib/trips/import-plan.js'

const REMOVE = process.argv.includes('--remove')

// Existing Cloudinary assets — the project has no Fukuoka/Osaka photography, so
// those borrow on-theme shots. Swap them from the admin cover picker later.
const IMG_HOKKAIDO =
  'https://res.cloudinary.com/dubett62q/image/upload/q_auto/f_auto/v1775941309/hokkaido_woibhv.jpg'
const IMG_KYOTO =
  'https://res.cloudinary.com/dubett62q/image/upload/q_auto/f_auto/v1775941309/20221009_185503_37323ab7_w1920_gkhahc.webp'
const IMG_TORII = 'https://res.cloudinary.com/dubett62q/image/upload/v1775942239/homeHERO_g6xadq.jpg'
const IMG_FUJI =
  'https://res.cloudinary.com/dubett62q/image/upload/q_auto/f_auto/v1775941821/jpeg_large_202112291737-94b1bc95b0fa46be3b8d4899657dcd1b_g6kjrq.jpg'

const t = (en: string, th: string) => ({ en, th })
/** Minimal activity in the authoring shape. */
const act = (slot: string, time: string, en: string, th: string, note?: string) => ({
  slot,
  time,
  name: t(en, th),
  description: t('', ''),
  notes: t(note ?? '', note ?? ''),
})

const MOCKS = [
  {
    prefix: 'HOK',
    source_file: 'mock-hokkaido.json',
    reference_date: '2026-01-15',
    overview: {
      title: 'Hokkaido Snow Escape',
      cover_tagline: 'หิมะ ออนเซ็น และซีฟู้ดสดที่สุดของญี่ปุ่น',
      description:
        'ห้าวันในฮอกไกโด — เล่นหิมะที่นิเซโกะ แช่ออนเซ็นกลางหุบเขา และกินซีฟู้ดตลาดเช้าที่ซัปโปโร',
      available_period: { primary: '1 Dec - 15 Mar' },
      recommended_period: [
        { primary: '20 Dec – 20 Feb', popular: true, details: 'หิมะหนาที่สุด เหมาะกับสกีและเทศกาลน้ำแข็ง' },
      ],
      available_airports: 'CTS',
      cover_images: [IMG_HOKKAIDO, IMG_FUJI],
      cover_places: ['Sapporo Canal, Hokkaido', 'Niseko Slopes, Hokkaido'],
      food_guide_th: 'ซีฟู้ดตลาดนิโจ ราเมนมิโสะ และซุปแกงกะหรี่',
    },
    highlights: [
      { name: 'Niseko', level: '😍', description: 'พาวเดอร์สโนว์ระดับโลก เหมาะทั้งมือใหม่และมือโปร' },
      { name: 'Noboribetsu Onsen', level: '😊', description: 'ออนเซ็นกลางหุบเขานรก บรรยากาศไอน้ำลอย' },
    ],
    days: [
      { day: 1, name: t('Land in Sapporo', 'ถึงซัปโปโร'), activities: [act('Logistics', '10:00', 'Arrive New Chitose', 'ถึงสนามบินนิวชิโตเซะ'), act('Dinner', '18:30', 'Miso ramen at Susukino', 'ราเมนมิโสะย่านซัสสึกิโนะ')] },
      { day: 2, name: t('Niseko powder day', 'วันเล่นหิมะนิเซโกะ'), activities: [act('Activity 1', '09:00', 'Ski lessons', 'เรียนสกีเบื้องต้น'), act('Lunch', '12:30', 'Slope-side curry', 'ข้าวแกงกะหรี่ริมลาน')] },
      { day: 3, name: t('Onsen and hell valley', 'ออนเซ็นและหุบเขานรก'), activities: [act('Activity 1', '10:00', 'Jigokudani walk', 'เดินชมหุบเขานรก'), act('Living', '15:00', 'Ryokan check-in', 'เข้าที่พักเรียวกัง')] },
      { day: 4, name: t('Otaru canal day', 'วันคลองโอตารุ'), activities: [act('Activity 1', '10:30', 'Otaru canal stroll', 'เดินเล่นคลองโอตารุ'), act('Activity 2', '14:00', 'Glass workshop', 'เวิร์กช็อปเป่าแก้ว')] },
      { day: 5, name: t('Market and fly home', 'ตลาดเช้าและกลับบ้าน'), activities: [act('Breakfast', '07:30', 'Nijo fish market', 'ตลาดปลานิโจ'), act('Logistics', '13:00', 'Fly out of CTS', 'บินกลับจาก CTS')] },
    ],
  },
  {
    prefix: 'FUK',
    source_file: 'mock-fukuoka.json',
    reference_date: '2026-03-20',
    overview: {
      title: 'Fukuoka Food Trail',
      cover_tagline: 'ต้นตำรับทงคตสึ ยาไต และวัดเงียบๆ ริมทะเล',
      description:
        'สี่วันในฟุกุโอกะ — กินราเมนต้นตำรับ นั่งยาไตริมแม่น้ำ และนั่งรถไฟไปดะไซฟุแบบไม่เร่งรีบ',
      available_period: { primary: '1 Mar - 30 Nov' },
      recommended_period: [
        { primary: '20 Mar – 10 Apr', popular: true, details: 'ซากุระบานที่ปราสาทฟุกุโอกะและดะไซฟุ' },
        { primary: '1 Oct – 20 Nov', details: 'อากาศเย็นสบาย ใบไม้เปลี่ยนสีที่ดะไซฟุ' },
      ],
      available_airports: 'FUK',
      cover_images: [IMG_TORII, IMG_KYOTO],
      cover_places: ['Dazaifu Tenmangu, Fukuoka', 'Kawabata Arcade, Hakata'],
      food_guide_th: 'ทงคตสึราเมน โมสึนาเบะ และเมนไทโกะ',
    },
    highlights: [
      { name: 'Yatai stalls', level: '😍', description: 'ร้านรถเข็นริมแม่น้ำนากะ เปิดหลังพระอาทิตย์ตก' },
      { name: 'Dazaifu Tenmangu', level: '😊', description: 'ศาลเจ้าเก่าแก่ เดินชิลล์ได้ทั้งบ่าย' },
    ],
    days: [
      { day: 1, name: t('Hakata first bite', 'คำแรกที่ฮากาตะ'), activities: [act('Logistics', '11:00', 'Arrive Fukuoka', 'ถึงสนามบินฟุกุโอกะ'), act('Dinner', '19:00', 'Yatai by the river', 'ยาไตริมแม่น้ำ')] },
      { day: 2, name: t('Dazaifu day trip', 'เที่ยวดะไซฟุ'), activities: [act('Activity 1', '09:30', 'Dazaifu Tenmangu', 'ศาลเจ้าดะไซฟุ'), act('Lunch', '12:30', 'Umegae mochi', 'โมจิอุเมะกาเอะ')] },
      { day: 3, name: t('City and coast', 'เมืองและชายทะเล'), activities: [act('Activity 1', '10:00', 'Fukuoka Castle ruins', 'ปราสาทฟุกุโอกะ'), act('Activity 2', '15:00', 'Momochi seaside', 'ชายหาดโมโมจิ')] },
      { day: 4, name: t('Last ramen', 'ราเมนมื้อสุดท้าย'), activities: [act('Lunch', '11:30', 'Tonkotsu at Ichiran HQ', 'ทงคตสึร้านต้นตำรับ'), act('Logistics', '15:00', 'Fly out of FUK', 'บินกลับจาก FUK')] },
    ],
  },
  {
    prefix: 'OSA',
    source_file: 'mock-osaka.json',
    reference_date: '2026-04-05',
    overview: {
      title: 'Osaka City Break',
      cover_tagline: 'สามวันกินให้พุงกาง เดินให้ทั่วโดทงโบริ',
      description:
        'สามวันในโอซาก้า — ทาโกยากิโดทงโบริ ปราสาทโอซาก้า และวันเดย์ทริปไปนาราแบบสบายๆ',
      available_period: { primary: '1 Mar - 30 Nov' },
      recommended_period: [
        { primary: '25 Mar – 15 Apr', popular: true, details: 'ซากุระเต็มปราสาทโอซาก้าและสวนคิเอมะ' },
      ],
      available_airports: 'KIX',
      cover_images: [IMG_KYOTO, IMG_FUJI],
      cover_places: ['Dotonbori, Osaka', 'Osaka Castle Park'],
      food_guide_th: 'ทาโกยากิ โอโคโนมิยากิ และคุชิคัตสึ',
    },
    highlights: [
      { name: 'Dotonbori', level: '😍', description: 'ป้ายไฟกลิโกะ ริมคลอง คึกคักถึงดึก' },
      { name: 'Nara day trip', level: '😊', description: 'ให้อาหารกวาง เดินวัดโทไดจิ ครึ่งวันสบายๆ' },
    ],
    days: [
      { day: 1, name: t('Neon and takoyaki', 'ป้ายไฟและทาโกยากิ'), activities: [act('Logistics', '12:00', 'Arrive Kansai', 'ถึงสนามบินคันไซ'), act('Dinner', '19:30', 'Dotonbori street food', 'สตรีทฟู้ดโดทงโบริ')] },
      { day: 2, name: t('Castle and Nara', 'ปราสาทและนารา'), activities: [act('Activity 1', '09:00', 'Osaka Castle', 'ปราสาทโอซาก้า'), act('Activity 2', '13:30', 'Nara deer park', 'สวนกวางนารา')] },
      { day: 3, name: t('Markets then home', 'ตลาดแล้วกลับ'), activities: [act('Brunch', '10:00', 'Kuromon market', 'ตลาดคุโรมง'), act('Logistics', '15:30', 'Fly out of KIX', 'บินกลับจาก KIX')] },
    ],
  },
]

async function main() {
  const host = process.env.DATABASE_URL?.match(/@([^/?]+)/)?.[1] ?? '(unknown)'
  console.log(`DB host: ${host}`)
  if (host.includes('twilight-hall') && process.env.USE_PROD_DB !== '1') {
    console.error('REFUSING: that is the PRODUCTION endpoint. Re-run with USE_PROD_DB=1 to mean it.')
    process.exit(1)
  }
  if (process.env.USE_PROD_DB === '1') console.log('⚠️  TARGETING PRODUCTION DB (USE_PROD_DB=1)')

  const systemUserId = await getSystemUserId()
  const existing = await prisma.template.findMany({ where: { createdById: systemUserId } })
  const bySource = new Map(
    existing.map((t) => [(t.itinerary as { sourceFile?: string } | null)?.sourceFile, t] as const),
  )

  for (const mock of MOCKS) {
    const prior = bySource.get(mock.source_file)

    if (REMOVE) {
      if (!prior) {
        console.log(`— ${mock.overview.title}: not present`)
        continue
      }
      // Same order as import-dopamichi's old delete path: linked Trips first
      // (the share-code bridge), then the Template.
      await prisma.trip.deleteMany({ where: { templateId: prior.id } })
      await prisma.template.delete({ where: { id: prior.id } })
      console.log(`✕ removed ${mock.overview.title}`)
      continue
    }

    const itinerary = importPlanJson(mock)
    const availability = deriveAvailability(itinerary)
    const data = {
      title: itinerary.title,
      description: itinerary.overview.cover_tagline ?? null,
      totalDays: itinerary.totalDays,
      season: itinerary.season ?? null,
      coverImages: itinerary.overview.cover_images ?? [],
      coverImage: (itinerary.overview.cover_images ?? [])[0] ?? null,
      itinerary: itinerary as unknown as Prisma.InputJsonValue,
      availability: availability as unknown as Prisma.InputJsonValue,
      published: true,
    }

    const tpl = prior
      ? await prisma.template.update({ where: { id: prior.id }, data })
      : await prisma.template.create({ data: { ...data, createdById: systemUserId } })

    const code = await generateShareCodeForTemplate(tpl.id, systemUserId, mock.prefix)
    console.log(
      `${prior ? '↻ updated' : '✓ created'} ${itinerary.title} → ${code} · ${itinerary.totalDays} days · ` +
        `availability ${JSON.stringify(availability)}`,
    )
  }

  console.log(REMOVE ? 'Mock trips removed.' : 'Mock trips seeded (published).')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
