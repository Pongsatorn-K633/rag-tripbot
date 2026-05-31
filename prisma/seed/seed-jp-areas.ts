/**
 * Seed JpArea — Japan's 8 regions + 47 prefectures (54 rows; Hokkaido is one row
 * of type "both"). `code` is the unique trip-code prefix (KYO-001, KAN-001).
 * Idempotent (upsert by code). Curated unique 3-letter codes — adjust as needed.
 *
 *   npx tsx prisma/seed/seed-jp-areas.ts   (or: npm run db:seed-jp-areas)
 */
import 'dotenv/config'
import { prisma } from '../../lib/db/index.js'

type Area = { code: string; name: string; nameTh?: string; type: 'prefecture' | 'region' | 'both'; regionCode?: string }

const AREAS: Area[] = [
  // ── Regions (self-reference: a region's bucket is itself) ─────────────────
  { code: 'TOH', name: 'Tohoku', nameTh: 'โทโฮคุ', type: 'region', regionCode: 'TOH' },
  { code: 'KAN', name: 'Kanto', nameTh: 'คันโต', type: 'region', regionCode: 'KAN' },
  { code: 'CHU', name: 'Chubu', nameTh: 'ชูบุ', type: 'region', regionCode: 'CHU' },
  { code: 'KSI', name: 'Kansai', nameTh: 'คันไซ', type: 'region', regionCode: 'KSI' },
  { code: 'CHG', name: 'Chugoku', nameTh: 'ชูโกคุ', type: 'region', regionCode: 'CHG' },
  { code: 'SHI', name: 'Shikoku', nameTh: 'ชิโกคุ', type: 'region', regionCode: 'SHI' },
  { code: 'KYU', name: 'Kyushu', nameTh: 'คิวชู', type: 'region', regionCode: 'KYU' },
  // ── Hokkaido — prefecture AND region ──────────────────────────────────────
  { code: 'HOK', name: 'Hokkaido', nameTh: 'ฮอกไกโด', type: 'both', regionCode: 'HOK' },
  // ── Tohoku ────────────────────────────────────────────────────────────────
  { code: 'AOM', name: 'Aomori', nameTh: 'อาโอโมริ', type: 'prefecture', regionCode: 'TOH' },
  { code: 'IWT', name: 'Iwate', nameTh: 'อิวาเตะ', type: 'prefecture', regionCode: 'TOH' },
  { code: 'MIY', name: 'Miyagi', nameTh: 'มิยางิ', type: 'prefecture', regionCode: 'TOH' },
  { code: 'AKI', name: 'Akita', nameTh: 'อาคิตะ', type: 'prefecture', regionCode: 'TOH' },
  { code: 'YGT', name: 'Yamagata', nameTh: 'ยามางาตะ', type: 'prefecture', regionCode: 'TOH' },
  { code: 'FKS', name: 'Fukushima', nameTh: 'ฟุกุชิมะ', type: 'prefecture', regionCode: 'TOH' },
  // ── Kanto ─────────────────────────────────────────────────────────────────
  { code: 'IBR', name: 'Ibaraki', nameTh: 'อิบารากิ', type: 'prefecture', regionCode: 'KAN' },
  { code: 'TOC', name: 'Tochigi', nameTh: 'โทจิงิ', type: 'prefecture', regionCode: 'KAN' },
  { code: 'GUN', name: 'Gunma', nameTh: 'กุมมะ', type: 'prefecture', regionCode: 'KAN' },
  { code: 'SAI', name: 'Saitama', nameTh: 'ไซตามะ', type: 'prefecture', regionCode: 'KAN' },
  { code: 'CHI', name: 'Chiba', nameTh: 'ชิบะ', type: 'prefecture', regionCode: 'KAN' },
  { code: 'TKY', name: 'Tokyo', nameTh: 'โตเกียว', type: 'prefecture', regionCode: 'KAN' },
  { code: 'KNG', name: 'Kanagawa', nameTh: 'คานางาวะ', type: 'prefecture', regionCode: 'KAN' },
  // ── Chubu ─────────────────────────────────────────────────────────────────
  { code: 'NII', name: 'Niigata', nameTh: 'นีงาตะ', type: 'prefecture', regionCode: 'CHU' },
  { code: 'TYM', name: 'Toyama', nameTh: 'โทยามะ', type: 'prefecture', regionCode: 'CHU' },
  { code: 'ISH', name: 'Ishikawa', nameTh: 'อิชิคาวะ', type: 'prefecture', regionCode: 'CHU' },
  { code: 'FKI', name: 'Fukui', nameTh: 'ฟุกุอิ', type: 'prefecture', regionCode: 'CHU' },
  { code: 'YMN', name: 'Yamanashi', nameTh: 'ยามานาชิ', type: 'prefecture', regionCode: 'CHU' },
  { code: 'NGN', name: 'Nagano', nameTh: 'นางาโนะ', type: 'prefecture', regionCode: 'CHU' },
  { code: 'GIF', name: 'Gifu', nameTh: 'กิฟุ', type: 'prefecture', regionCode: 'CHU' },
  { code: 'SZK', name: 'Shizuoka', nameTh: 'ชิซึโอกะ', type: 'prefecture', regionCode: 'CHU' },
  { code: 'AIC', name: 'Aichi', nameTh: 'ไอจิ', type: 'prefecture', regionCode: 'CHU' },
  // ── Kansai ────────────────────────────────────────────────────────────────
  { code: 'MIE', name: 'Mie', nameTh: 'มิเอะ', type: 'prefecture', regionCode: 'KSI' },
  { code: 'SHG', name: 'Shiga', nameTh: 'ชิงะ', type: 'prefecture', regionCode: 'KSI' },
  { code: 'KYO', name: 'Kyoto', nameTh: 'เกียวโต', type: 'prefecture', regionCode: 'KSI' },
  { code: 'OSA', name: 'Osaka', nameTh: 'โอซากะ', type: 'prefecture', regionCode: 'KSI' },
  { code: 'HYG', name: 'Hyogo', nameTh: 'เฮียวโงะ', type: 'prefecture', regionCode: 'KSI' },
  { code: 'NAR', name: 'Nara', nameTh: 'นาระ', type: 'prefecture', regionCode: 'KSI' },
  { code: 'WAK', name: 'Wakayama', nameTh: 'วากายามะ', type: 'prefecture', regionCode: 'KSI' },
  // ── Chugoku ───────────────────────────────────────────────────────────────
  { code: 'TTR', name: 'Tottori', nameTh: 'ทตโตริ', type: 'prefecture', regionCode: 'CHG' },
  { code: 'SMN', name: 'Shimane', nameTh: 'ชิมาเนะ', type: 'prefecture', regionCode: 'CHG' },
  { code: 'OKY', name: 'Okayama', nameTh: 'โอกายามะ', type: 'prefecture', regionCode: 'CHG' },
  { code: 'HRS', name: 'Hiroshima', nameTh: 'ฮิโรชิมะ', type: 'prefecture', regionCode: 'CHG' },
  { code: 'YGC', name: 'Yamaguchi', nameTh: 'ยามากุจิ', type: 'prefecture', regionCode: 'CHG' },
  // ── Shikoku ───────────────────────────────────────────────────────────────
  { code: 'TKS', name: 'Tokushima', nameTh: 'โทกุชิมะ', type: 'prefecture', regionCode: 'SHI' },
  { code: 'KGW', name: 'Kagawa', nameTh: 'คางาวะ', type: 'prefecture', regionCode: 'SHI' },
  { code: 'EHM', name: 'Ehime', nameTh: 'เอฮิเมะ', type: 'prefecture', regionCode: 'SHI' },
  { code: 'KOC', name: 'Kochi', nameTh: 'โคจิ', type: 'prefecture', regionCode: 'SHI' },
  // ── Kyushu (incl. Okinawa) ────────────────────────────────────────────────
  { code: 'FKO', name: 'Fukuoka', nameTh: 'ฟุกุโอกะ', type: 'prefecture', regionCode: 'KYU' },
  { code: 'SAG', name: 'Saga', nameTh: 'ซางะ', type: 'prefecture', regionCode: 'KYU' },
  { code: 'NGS', name: 'Nagasaki', nameTh: 'นางาซากิ', type: 'prefecture', regionCode: 'KYU' },
  { code: 'KUM', name: 'Kumamoto', nameTh: 'คุมาโมโตะ', type: 'prefecture', regionCode: 'KYU' },
  { code: 'OIT', name: 'Oita', nameTh: 'โออิตะ', type: 'prefecture', regionCode: 'KYU' },
  { code: 'MZK', name: 'Miyazaki', nameTh: 'มิยาซากิ', type: 'prefecture', regionCode: 'KYU' },
  { code: 'KGS', name: 'Kagoshima', nameTh: 'คาโงชิมะ', type: 'prefecture', regionCode: 'KYU' },
  { code: 'OKW', name: 'Okinawa', nameTh: 'โอกินาวะ', type: 'prefecture', regionCode: 'KYU' },
]

async function main() {
  let created = 0
  let updated = 0
  for (let i = 0; i < AREAS.length; i++) {
    const a = AREAS[i]
    const data = { name: a.name, nameTh: a.nameTh ?? null, type: a.type, regionCode: a.regionCode ?? null, sortOrder: i }
    const existing = await prisma.jpArea.findUnique({ where: { code: a.code }, select: { code: true } })
    await prisma.jpArea.upsert({ where: { code: a.code }, create: { code: a.code, ...data }, update: data })
    if (existing) updated++
    else created++
  }
  const [total, pref, region, both] = await Promise.all([
    prisma.jpArea.count(),
    prisma.jpArea.count({ where: { type: 'prefecture' } }),
    prisma.jpArea.count({ where: { type: 'region' } }),
    prisma.jpArea.count({ where: { type: 'both' } }),
  ])
  console.log(`JpArea seeded: ${created} created, ${updated} updated.`)
  console.log(`Total ${total} (${pref} prefecture, ${region} region, ${both} both)`)
}

main()
  .catch((e) => { console.error('Seed failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
