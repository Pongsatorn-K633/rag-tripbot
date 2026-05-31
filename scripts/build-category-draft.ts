/**
 * Draft of the dopamichi Category taxonomy (destination-agnostic, Japan-first).
 * Adapted from the user's Bangkok-flavored Category.xlsx example into the Japan
 * travel context, tagging each row generic | JP so other destinations can be
 * added later without disturbing shared rows.
 *
 *   npx tsx scripts/build-category-draft.ts
 * Outputs docs/template-structure/dopamichi-categories.{json,xlsx} for review.
 *
 * Columns:
 *   code         stable slug a Node references (root.cat.leaf)
 *   root         top bucket   | category  mid group | subCategory  leaf node type
 *   emoji        icon
 *   filterGroup  transport grouping only (public_transport|on_demand|private_transport)
 *   destination  generic | JP  (JP = Japan-specific; add TH/KR/… later)
 *   description  Thai/EN hint
 */
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import * as XLSX from 'xlsx'

type Cat = {
  code: string; root: string; category: string; subCategory: string
  emoji: string; filterGroup: string; destination: 'generic' | 'JP'; description: string
}
const C = (code: string, root: string, category: string, subCategory: string, emoji: string, destination: 'generic' | 'JP', description = '', filterGroup = ''): Cat =>
  ({ code, root, category, subCategory, emoji, filterGroup, destination, description })

const CATEGORIES: Cat[] = [
  // ── Logistics (transport — mostly destination-specific) ───────────────────
  C('log.rail.jr',         'Logistics', 'Rail',             'JR (Local/Rapid)',   '🚃', 'JP', 'JR ในเมือง — Local/Rapid', 'public_transport'),
  C('log.rail.shinkansen', 'Logistics', 'Rail',             'Shinkansen',         '🚅', 'JP', 'รถไฟหัวกระสุนระหว่างเมือง', 'public_transport'),
  C('log.rail.metro',      'Logistics', 'Rail',             'Subway / Metro',     '🚇', 'JP', 'Tokyo Metro, Toei, Osaka Metro', 'public_transport'),
  C('log.rail.private',    'Logistics', 'Rail',             'Private Railway',    '🚆', 'JP', 'Keio, Tokyu, Hankyu, Kintetsu…', 'public_transport'),
  C('log.rail.ltdexp',     'Logistics', 'Rail',             'Limited Express',    '🚄', 'JP', 'Ltd. Express / Narita Express / Haruka', 'public_transport'),
  C('log.rail.tram',       'Logistics', 'Rail',             'Tram / Streetcar',   '🚋', 'JP', 'เช่น Arashiyama, Hakodate', 'public_transport'),
  C('log.road.citybus',    'Logistics', 'Road (Public)',    'City Bus',           '🚌', 'generic', 'รถเมล์ในเมือง', 'public_transport'),
  C('log.road.highwaybus', 'Logistics', 'Road (Public)',    'Highway / Night Bus','🚌', 'JP', 'รถบัสระหว่างเมือง / กลางคืน', 'public_transport'),
  C('log.road.airportbus', 'Logistics', 'Road (Public)',    'Airport Bus',        '🚐', 'JP', 'Airport Limousine', 'public_transport'),
  C('log.hire.taxi',       'Logistics', 'Road (Hire)',      'Taxi',               '🚕', 'generic', '', 'on_demand'),
  C('log.hire.rideapp',    'Logistics', 'Road (Hire)',      'Ride App',           '📱', 'generic', 'GO, Uber (จำกัด)', 'on_demand'),
  C('log.hire.rentalcar',  'Logistics', 'Road (Hire)',      'Rental Car',         '🚗', 'generic', '', 'private_transport'),
  C('log.air.domestic',    'Logistics', 'Air',              'Domestic Flight',    '✈️', 'generic', 'บินภายในประเทศ (Hokkaido/Okinawa)', 'public_transport'),
  C('log.water.ferry',     'Logistics', 'Water',            'Ferry',              '⛴️', 'generic', '', 'public_transport'),
  C('log.water.cruise',    'Logistics', 'Water',            'Sightseeing Cruise', '🛥️', 'generic', '', 'public_transport'),
  C('log.active.walk',     'Logistics', 'Active',           'Walking',            '🚶', 'generic', 'เส้นทางเดิน + ลิงก์นำทาง', 'public_transport'),
  C('log.active.bike',     'Logistics', 'Active',           'Bicycle Rental',     '🚲', 'generic', '', 'on_demand'),

  // ── Living ────────────────────────────────────────────────────────────────
  C('live.stay.hotel',    'Living', 'Stay', 'Hotel',             '🏨', 'generic', 'Luxury / Boutique / Resort'),
  C('live.stay.business', 'Living', 'Stay', 'Business Hotel',    '🏢', 'JP', 'APA, Toyoko Inn…'),
  C('live.stay.ryokan',   'Living', 'Stay', 'Ryokan',           '⛩️', 'JP', 'เรียวกัง + ออนเซ็น/ไคเซกิ'),
  C('live.stay.capsule',  'Living', 'Stay', 'Capsule / Hostel', '🛏️', 'JP', 'แคปซูล / โฮสเทล / เกสต์เฮาส์'),
  C('live.stay.rental',   'Living', 'Stay', 'Short-term Rental','🏡', 'generic', 'Airbnb / อพาร์ตเมนต์'),
  C('live.stay.unique',   'Living', 'Stay', 'Unique Stay',      '⛺', 'generic', 'Glamping / Minshuku / Temple Stay'),
  C('live.stay.transit',  'Living', 'Stay', 'Transit Stay',     '🛋️', 'generic', 'Airport lounge / day-use'),

  // ── Food & Beverage ──────────────────────────────────────────────────────
  C('food.dine.restaurant','Food & Beverage', 'Dining', 'Restaurant',        '🍽️', 'generic', 'ทั่วไป / Casual / Fine'),
  C('food.dine.ramen',     'Food & Beverage', 'Dining', 'Ramen / Noodles',   '🍜', 'JP', 'ราเมน / โซบะ / อุด้ง'),
  C('food.dine.sushi',     'Food & Beverage', 'Dining', 'Sushi / Omakase',   '🍣', 'JP'),
  C('food.dine.yakiniku',  'Food & Beverage', 'Dining', 'Yakiniku / Teppan', '🥩', 'JP', 'ปิ้งย่าง / เทปปันยากิ'),
  C('food.dine.izakaya',   'Food & Beverage', 'Dining', 'Izakaya',           '🍶', 'JP', 'ร้านเหล้า + กับแกล้ม'),
  C('food.dine.kaiseki',   'Food & Beverage', 'Dining', 'Kaiseki / Fine',    '🍱', 'JP', 'อาหารชั้นสูงตามฤดูกาล'),
  C('food.dine.depachika', 'Food & Beverage', 'Dining', 'Depachika / Hall',  '🏬', 'JP', 'ใต้ห้าง — อาหารพร้อมทาน'),
  C('food.dine.konbini',   'Food & Beverage', 'Dining', 'Convenience Store', '🏪', 'JP', 'konbini — 7/Lawson/FamilyMart'),
  C('food.dine.street',    'Food & Beverage', 'Dining', 'Street Food',       '🍢', 'generic', 'แผงข้างทาง / ตลาดกลางคืน'),
  C('food.cafe.cafe',      'Food & Beverage', 'Cafe',   'Cafe',              '☕', 'generic'),
  C('food.cafe.kissaten',  'Food & Beverage', 'Cafe',   'Kissaten',          '🍮', 'JP', 'คาเฟ่เรโทรญี่ปุ่น'),
  C('food.cafe.sweets',    'Food & Beverage', 'Cafe',   'Sweets / Bakery',   '🍰', 'generic', 'ขนม / เบเกอรี / มัทฉะ'),
  C('food.bar.bar',        'Food & Beverage', 'Bar',    'Bar / Standing Bar','🍸', 'generic', 'บาร์ / รูฟท็อป / tachinomi'),

  // ── Experiences ──────────────────────────────────────────────────────────
  C('exp.land.temple',     'Experiences', 'Landmark', 'Temple & Shrine',  '⛩️', 'JP', 'วัด / ศาลเจ้า'),
  C('exp.land.castle',     'Experiences', 'Landmark', 'Castle',           '🏯', 'JP'),
  C('exp.land.nature',     'Experiences', 'Landmark', 'Park & Nature',    '🌳', 'generic', 'สวน / ภูเขา / ชายหาด / เดินป่า'),
  C('exp.land.garden',     'Experiences', 'Landmark', 'Japanese Garden',  '🍁', 'JP'),
  C('exp.land.museum',     'Experiences', 'Landmark', 'Arts & Museums',   '🎨', 'generic'),
  C('exp.land.observation','Experiences', 'Landmark', 'Observation Deck', '🗼', 'generic', 'จุดชมวิว / หอคอย'),
  C('exp.land.themepark',  'Experiences', 'Landmark', 'Theme Park',       '🎢', 'generic', 'Disney / USJ / สวนสนุก'),
  C('exp.act.onsen',       'Experiences', 'Activity', 'Onsen / Sento',    '♨️', 'JP', 'ออนเซ็น / เซ็นโต'),
  C('exp.act.seasonal',    'Experiences', 'Activity', 'Seasonal',         '🌸', 'JP', 'ซากุระ / ใบไม้แดง / หิมะ'),
  C('exp.act.ski',         'Experiences', 'Activity', 'Ski / Snow',       '🎿', 'JP'),
  C('exp.act.workshop',    'Experiences', 'Activity', 'Workshop',         '🧶', 'generic', 'ทำอาหาร / พิธีชงชา / คราฟต์'),
  C('exp.act.strolling',   'Experiences', 'Activity', 'Strolling',        '🚶‍♂️', 'generic', 'เดินเล่นชมเมือง'),
  C('exp.act.extreme',     'Experiences', 'Activity', 'Extreme Activity', '🏄', 'generic'),
  C('exp.night.club',      'Experiences', 'Nightlife','Night Club',       '💃', 'generic'),
  C('exp.night.livehouse', 'Experiences', 'Nightlife','Live House',       '🎤', 'JP', 'ดนตรีสด'),
  C('exp.svc.beauty',      'Experiences', 'Service',  'Beauty',           '💅', 'generic', 'ทำเล็บ / ผม'),

  // ── Goods & Retail ───────────────────────────────────────────────────────
  C('shop.dept',       'Goods & Retail', 'Shopping', 'Department Store',   '🏬', 'JP', 'Isetan, Takashimaya…'),
  C('shop.mall',       'Goods & Retail', 'Shopping', 'Shopping Mall',      '🛍️', 'generic'),
  C('shop.shotengai',  'Goods & Retail', 'Shopping', 'Shopping Street',    '🏮', 'JP', 'Shotengai / ถนนการค้า'),
  C('shop.market',     'Goods & Retail', 'Shopping', 'Local Market',       '🐟', 'generic', 'ตลาดสด เช่น Nishiki / Tsukiji'),
  C('shop.donki',      'Goods & Retail', 'Shopping', 'Discount / Drugstore','💊', 'JP', 'Don Quijote / ร้านยา'),
  C('shop.electronics','Goods & Retail', 'Shopping', 'Electronics',        '📷', 'JP', 'Akihabara / Yodobashi / BIC'),
  C('shop.anime',      'Goods & Retail', 'Shopping', 'Anime & Hobby',      '🎮', 'JP', 'ของอนิเมะ / มังงะ / ฟิกเกอร์'),
  C('shop.100yen',     'Goods & Retail', 'Shopping', '100-Yen Shop',       '🪙', 'JP', 'Daiso / Seria'),
  C('shop.souvenir',   'Goods & Retail', 'Shopping', 'Souvenirs / Omiyage','🎁', 'JP', 'ของฝาก'),
  C('shop.specialty',  'Goods & Retail', 'Shopping', 'Specialty / Vintage','👕', 'generic', 'วินเทจ / มือสอง'),

  // ── Admin & Services ─────────────────────────────────────────────────────
  C('svc.locker',     'Admin & Services', 'Utility',  'Coin Locker / Luggage', '🛅', 'JP', 'ตู้ล็อกเกอร์ / ฝากกระเป๋า'),
  C('svc.parking',    'Admin & Services', 'Utility',  'Parking',               '🅿️', 'generic'),
  C('svc.info',       'Admin & Services', 'Utility',  'Tourist Info',          'ℹ️', 'generic'),
  C('svc.rental',     'Admin & Services', 'Utility',  'Rental (Gear/Wifi)',    '🎒', 'generic', 'เช่าอุปกรณ์ / pocket wifi / กิโมโน'),
  C('svc.pass.jr',    'Admin & Services', 'Passes',   'JR Pass',               '🎫', 'JP', 'JR Pass / regional passes'),
  C('svc.pass.ic',    'Admin & Services', 'Passes',   'IC Card',               '💳', 'JP', 'Suica / Pasmo / ICOCA'),
  C('svc.pass.ticket','Admin & Services', 'Passes',   'Attraction Ticket',     '🎟️', 'generic', 'บัตรเข้าชม / จองล่วงหน้า'),

  // ── Emergency ────────────────────────────────────────────────────────────
  C('emg.finance', 'Emergency', 'Emergency', 'Finance',       '💰', 'JP', 'ATM (7-Bank) / แลกเงิน'),
  C('emg.health',  'Emergency', 'Emergency', 'Health',        '🏥', 'generic', 'โรงพยาบาล / ร้านยา / คลินิก'),
  C('emg.comm',    'Emergency', 'Emergency', 'Communication', '📶', 'generic', 'SIM / pocket wifi / ไปรษณีย์'),
  C('emg.docs',    'Emergency', 'Emergency', 'Documentation', '🛂', 'generic', 'สถานทูต / วีซ่า'),
  C('emg.police',  'Emergency', 'Emergency', 'Police / Koban','👮', 'JP', 'ป้อมตำรวจ / Help desk'),
  C('emg.laundry', 'Emergency', 'Emergency', 'Laundry',       '🧺', 'generic', 'Coin laundry'),
]

const outDir = join(process.cwd(), 'docs', 'template-structure')
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'dopamichi-categories.json'), JSON.stringify(CATEGORIES, null, 2), 'utf8')

const legend = [
  { col: 'code', meaning: 'Stable slug a Node references (root.cat.leaf). Never change once used.' },
  { col: 'root', meaning: '7 top buckets: Logistics, Living, Food & Beverage, Experiences, Goods & Retail, Admin & Services, Emergency' },
  { col: 'category', meaning: 'Mid-level group within a root' },
  { col: 'subCategory', meaning: 'Leaf node type (what a place IS)' },
  { col: 'filterGroup', meaning: 'Transport-only grouping: public_transport | on_demand | private_transport' },
  { col: 'destination', meaning: 'generic = applies anywhere · JP = Japan-specific. Add TH/KR/… rows later without touching generic ones.' },
]

const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(CATEGORIES), 'Categories')
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(legend), 'Legend')
XLSX.writeFile(wb, join(outDir, 'dopamichi-categories.xlsx'))

const byRoot = CATEGORIES.reduce<Record<string, number>>((a, c) => ((a[c.root] = (a[c.root] ?? 0) + 1), a), {})
console.log(`Wrote ${CATEGORIES.length} categories (${CATEGORIES.filter(c => c.destination === 'JP').length} JP-specific, ${CATEGORIES.filter(c => c.destination === 'generic').length} generic)`)
console.log('By root:', byRoot)
console.log('  → docs/template-structure/dopamichi-categories.json + .xlsx')
