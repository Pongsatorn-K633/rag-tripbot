/**
 * Seed script for itinerary_blocks table.
 * Inserts at least:
 *   - 1 core block (multi-city backbone itinerary)
 *   - 2 extension blocks (add-on segments)
 *   - 1 day_trip block (single-day excursion)
 *
 * Embeddings (vector column) are left NULL — the RAG Agent's embedder
 * (lib/rag/embedder.ts) will populate them using BGE-M3.
 *
 * Run with: npx tsx prisma/seed/seed-blocks.ts
 */
import 'dotenv/config'
import { prisma } from '../../lib/db/index.js'

async function main() {
  // ── CORE BLOCK: 7-day Tokyo–Kyoto–Osaka backbone ──────────────────────────
  await prisma.$executeRaw`
    INSERT INTO itinerary_blocks (content, type, duration, start_loc, end_loc, season, tags)
    VALUES (
      'วันที่ 1-7: โตเกียว (3 คืน) → เกียวโต (2 คืน) → โอซาก้า (2 คืน)
วันที่ 1-3 โตเกียว: ชิบุย่า (สี่แยก Scramble Crossing), ฮาราจุกุ (ถนน Takeshita), อากิฮาบาระ (ย่านอิเล็กทรอนิกส์), วัดเซ็นโซจิในอาซากุสะ, ชมวิวจากหอคอยสกายทรี
วันที่ 4-5 เกียวโต: ศาลเจ้าฟูชิมิ อินาริ (ทางเดินโทริอิสีส้มหลายพันประตู), อาราชิยาม่า (ป่าไผ่ไซโอจิ), ย่านกิออน (พบเกอิชา), วัดคินคาคุจิ (วัดทองคำ)
วันที่ 6-7 โอซาก้า: โดทงโบริ (ป้ายไฟ Glico Man), นัมบะ (ช้อปปิ้งและอาหารข้างทาง), ปราสาทโอซาก้า
เดินทาง: ใช้ JR Pass (Shinkansen โตเกียว-เกียวโต ใช้เวลา 2.5 ชั่วโมง)',
      'core',
      7,
      'Tokyo',
      'Osaka',
      ARRAY['Winter', 'Spring', 'Autumn', 'Summer'],
      ARRAY['city', 'culture', 'food', 'shopping', 'temples']
    )
    ON CONFLICT DO NOTHING
  `
  console.log('Inserted core block: 7-day Tokyo-Kyoto-Osaka')

  // ── EXTENSION BLOCK 1: +2 days Nara ───────────────────────────────────────
  await prisma.$executeRaw`
    INSERT INTO itinerary_blocks (content, type, duration, start_loc, end_loc, season, tags)
    VALUES (
      'ต่อเติม 2 วัน: นารา (day trip หรือค้างคืน 1 คืน)
วันที่ 1 นารา: อุทยานนารา (กวางกว่า 1,200 ตัวเดินอิสระ), วัดโทไดจิ (หลวงพ่อโต Daibutsu สูง 15 เมตร), ศาลเจ้าคาสุกะ ไทชะ (ตะเกียงหินพันดวง)
วันที่ 2: ย่าน Naramachi (บ้านพาณิชย์ยุคเอโดะ), ไนท์มาร์เก็ต, กลับเกียวโตหรือโอซาก้า
เดินทาง: จากโอซาก้าหรือเกียวโต ใช้รถไฟ Kintetsu Nara Line (~45 นาที)
เหมาะกับ: ฤดูใบไม้ผลิ (ซากุระในอุทยาน) และฤดูใบไม้ร่วง',
      'extension',
      2,
      'Osaka',
      'Nara',
      ARRAY['Spring', 'Autumn', 'Winter'],
      ARRAY['nature', 'temples', 'history', 'deer park']
    )
    ON CONFLICT DO NOTHING
  `
  console.log('Inserted extension block: +2 days Nara')

  // ── EXTENSION BLOCK 2: +2 days Hakone ─────────────────────────────────────
  await prisma.$executeRaw`
    INSERT INTO itinerary_blocks (content, type, duration, start_loc, end_loc, season, tags)
    VALUES (
      'ต่อเติม 2 วัน: ฮาโกเน่ (ภูเขาไฟฟูจิและออนเซ็น)
วันที่ 1 ฮาโกเน่: กระเช้าลอยฟ้า Komagatake, ทะเลสาบ Ashi (ล่องเรือชมฟูจิ), Open Air Museum (พิพิธภัณฑ์กลางแจ้ง), ออนเซ็นริมภูเขา
วันที่ 2: Owakudani (หุบเขาซัลเฟอร์ กินไข่ดำมงคล), ชมทิวทัศน์ภูเขาไฟฟูจิ, กลับโตเกียวทาง Romancecar หรือ Shinkansen
เดินทาง: จากโตเกียว ใช้ Romancecar (Odakyu Line) ~85 นาที หรือ Shinkansen ไป Odawara แล้วเปลี่ยน
เหมาะกับ: ฤดูหนาว (เห็นฟูจิชัดเจนที่สุด) และฤดูใบไม้ร่วง',
      'extension',
      2,
      'Tokyo',
      'Hakone',
      ARRAY['Winter', 'Autumn', 'Spring'],
      ARRAY['nature', 'onsen', 'mountain', 'Mt Fuji', 'hot spring']
    )
    ON CONFLICT DO NOTHING
  `
  console.log('Inserted extension block: +2 days Hakone')

  // ── DAY TRIP BLOCK: Nikko ──────────────────────────────────────────────────
  await prisma.$executeRaw`
    INSERT INTO itinerary_blocks (content, type, duration, start_loc, end_loc, season, tags)
    VALUES (
      'ทริปเดย์ทริป 1 วัน: นิกโก้ (มรดกโลก UNESCO จากโตเกียว)
เช้า: ออกจากโตเกียวโดย JR Nikko Line หรือ Tobu Nikko Line (ใช้เวลา ~2 ชั่วโมง)
กลางวัน: ศาลเจ้าโทโชงุ (Toshogu Shrine) — สุสานโชกุน Tokugawa Ieyasu ประดับทองคำและแกะสลักละเอียด, ประตู Yomeimon (ประตูแห่งแสงอาทิตย์ขึ้น), วัดรินโนจิ
บ่าย: น้ำตกเคกอน (Kegon Falls) สูง 97 เมตร, ทะเลสาบชูเซนจิ, ออนเซ็นน้อย
เย็น: กลับโตเกียว
เหมาะกับ: ทุกฤดู — สวยงามโดยเฉพาะฤดูใบไม้ร่วง (ปลายตุลาคม-พฤศจิกายน)',
      'day_trip',
      1,
      'Tokyo',
      'Nikko',
      ARRAY['Spring', 'Summer', 'Autumn', 'Winter'],
      ARRAY['UNESCO', 'shrine', 'waterfall', 'nature', 'history']
    )
    ON CONFLICT DO NOTHING
  `
  console.log('Inserted day_trip block: Nikko day trip')

  // ── VERIFY ─────────────────────────────────────────────────────────────────
  const rows = await prisma.$queryRaw<Array<{ id: number; type: string; start_loc: string; end_loc: string; duration: number }>>`
    SELECT id, type, start_loc, end_loc, duration FROM itinerary_blocks ORDER BY id
  `
  console.log('\nAll blocks in itinerary_blocks:')
  rows.forEach((r) => {
    console.log(`  [${r.id}] type=${r.type} | ${r.start_loc} → ${r.end_loc} | ${r.duration} day(s)`)
  })
  console.log('\nSeed complete.')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
