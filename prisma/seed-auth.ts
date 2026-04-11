/**
 * Seeds the curated templates into the Template table, owned by a reserved
 * "system" user. Idempotent — safe to re-run (upserts by stable slug-based ID).
 *
 *   npx tsx prisma/seed-auth.ts
 *
 * Templates use the enhanced itinerary model with:
 *   - priority: 'mandatory' | 'recommended' | 'optional' per activity
 *   - category: 'flight' | 'transport' | 'sightseeing' | 'food' | etc.
 *   - cost / duration hints
 *   - choices: pick-one-of-N for restaurants, hotels, experiences
 *   - (accommodationChoices removed from curated plans — hotels need advance booking, not on-spot decisions)
 *   - transportNotes: extra tips (buy Suica, last train, etc.)
 */
import { prisma } from '../lib/db'

const SYSTEM_USER_EMAIL = 'system@dopamichi.local'

const TEMPLATES = [
  {
    slug: 'hokkaido-snow-adventure',
    title: 'Hokkaido Snow Adventure',
    totalDays: 5,
    season: 'Winter',
    coverImage: 'stock3',
    description:
      'ผจญภัยหิมะที่ฮอกไกโด สัมผัสเทศกาลหิมะซัปโปโร เล่นสกีที่นิเซโกะ และบรรยากาศเมืองริมทะเลโอทารุ',
    days: [
      {
        day: 1,
        location: 'Sapporo',
        activities: [
          {
            time: '09:30',
            name: 'Arrive at New Chitose Airport',
            notes: 'รับกระเป๋า + ซื้อบัตร Kitaca/Suica ที่ JR counter ชั้น B1',
            priority: 'mandatory',
            category: 'flight',
            duration: '1h',
          },
          {
            time: '11:00',
            name: 'Sapporo Beer Museum',
            notes: 'ทัวร์ฟรี + ชิมเบียร์สดจากโรงงาน',
            priority: 'optional',
            category: 'sightseeing',
            duration: '1.5h',
            cost: 'Free (ชิมเบียร์ ¥200-600)',
          },
          {
            time: '14:00',
            name: 'Odori Park Snow Festival Site',
            notes: 'ช่วง Feb มีเทศกาลหิมะ ประติมากรรมน้ำแข็งยักษ์',
            priority: 'recommended',
            category: 'sightseeing',
            duration: '2h',
            cost: 'Free',
          },
        ],
        choices: [
          {
            label: 'อาหารเย็นซัปโปโร · Dinner in Sapporo',
            priority: 'optional',
            category: 'food',
            options: [
              { time: '18:00', name: 'Susukino Ramen Village', notes: 'ราเมนซัปโปโรต้นตำรับ หลายร้านให้เลือก', cost: '¥1,000-1,500', category: 'food' },
              { time: '18:00', name: 'Daruma Genghis Khan', notes: 'เนื้อแกะย่างสไตล์ฮอกไกโด ร้านดังตั้งแต่ 1954', cost: '¥2,500', category: 'food' },
              { time: '18:00', name: 'Soup Curry GARAKU', notes: 'ซุปแกงกะหรี่โฮมเมด ต้นตำรับซัปโปโร', cost: '¥1,500', category: 'food' },
            ],
          },
        ],
        accommodation: 'JR Tower Hotel Nikko Sapporo',
        transport: 'New Chitose Airport → Sapporo (JR Rapid Airport, 37 min)',
        transportNotes: 'ซื้อ Kitaca card ที่สนามบิน ใช้ได้ทั้ง JR + Metro + ร้านค้า',
      },
      {
        day: 2,
        location: 'Otaru',
        activities: [
          {
            time: '09:00',
            name: 'Otaru Canal Morning Walk',
            notes: 'ถ่ายรูปคลองโอทารุตอนเช้า หิมะปกคลุมสวยมาก',
            priority: 'recommended',
            category: 'sightseeing',
            duration: '1h',
            cost: 'Free',
          },
          {
            time: '11:00',
            name: 'Sakaimachi Street Glass Shops',
            notes: 'ถนนช้อปปิ้ง เครื่องแก้ว กล่องดนตรี ขนม',
            priority: 'optional',
            category: 'shopping',
            duration: '1.5h',
          },
        ],
        choices: [
          {
            label: 'อาหารกลางวันโอทารุ · Lunch in Otaru',
            priority: 'recommended',
            category: 'food',
            options: [
              { time: '13:00', name: 'Otaru Masazushi (政寿司)', notes: 'ซูชิสดจากท่าเรือ ร้านดังตั้งแต่ 1938', cost: '¥3,000-5,000', category: 'food' },
              { time: '13:00', name: 'Naruto Honten (なると本店)', notes: 'ไก่ทอดครึ่งตัว (Wakadori) เมนูดังของโอทารุ', cost: '¥1,200', category: 'food' },
              { time: '13:00', name: 'LeTAO Pathos', notes: 'เค้กชีสดับเบิ้ล + อาหารกลางวันเบาๆ', cost: '¥1,500', category: 'food' },
            ],
          },
        ],
        accommodation: 'JR Tower Hotel Nikko Sapporo',
        transport: 'JR Hakodate Line ซัปโปโร↔โอทารุ (40 min, ¥750)',
        transportNotes: 'เดย์ทริป — ไม่ต้องย้ายที่พัก กลับซัปโปโรเย็น',
      },
      {
        day: 3,
        location: 'Niseko',
        activities: [
          {
            time: '08:00',
            name: 'Niseko United Ski Resort',
            notes: 'รวม 4 รีสอร์ตสกีขนาดใหญ่ — Grand Hirafu, Hanazono, Niseko Village, Annupuri',
            priority: 'recommended',
            category: 'experience',
            duration: '4h',
            cost: '¥6,500 (1-day lift pass)',
          },
          {
            time: '12:00',
            name: 'Lunch at Grand Hirafu Village',
            priority: 'optional',
            category: 'food',
            cost: '¥1,500-2,000',
          },
          {
            time: '16:00',
            name: 'Onsen after Skiing',
            notes: 'น้ำพุร้อนช่วยฟื้นฟูกล้ามเนื้อ แนะนำ Yukoro or Hilton onsen',
            priority: 'recommended',
            category: 'experience',
            duration: '1.5h',
            cost: '¥800-1,500',
          },
        ],
        accommodation: 'Hilton Niseko Village',
        transport: 'Hokkaido Resort Liner Bus ซัปโปโร→นิเซโกะ (2.5h)',
        transportNotes: 'จองล่วงหน้าออนไลน์ที่ access-n.jp — ที่นั่งจำกัดช่วง peak season',
      },
      {
        day: 4,
        location: 'Niseko',
        activities: [
          {
            time: '08:00',
            name: 'Morning Powder Ski Run',
            notes: 'หิมะผงนิเซโกะชื่อดังระดับโลก ไปเช้าได้หิมะสดที่สุด',
            priority: 'recommended',
            category: 'experience',
            duration: '3h',
          },
          {
            time: '13:00',
            name: 'Snowshoeing Tour',
            notes: 'เดินชมธรรมชาติบนหิมะ ไม่ต้องสกีเป็นก็เที่ยวได้',
            priority: 'optional',
            category: 'experience',
            duration: '2h',
            cost: '¥5,000 (guided tour)',
          },
          {
            time: '17:00',
            name: 'Mt. Yotei View Sunset',
            notes: 'จุดชมวิวภูเขาโยเทอิ (Ezo Fuji) ตอนพระอาทิตย์ตก',
            priority: 'optional',
            category: 'sightseeing',
            cost: 'Free',
          },
        ],
        accommodation: 'Hilton Niseko Village',
        transport: 'ใช้ Shuttle Bus ภายในรีสอร์ต (ฟรี)',
      },
      {
        day: 5,
        location: 'Sapporo',
        activities: [
          {
            time: '09:00',
            name: 'Moerenuma Park (Isamu Noguchi)',
            notes: 'สวนสาธารณะออกแบบโดย Isamu Noguchi ประติมากรชื่อดัง',
            priority: 'optional',
            category: 'sightseeing',
            duration: '1.5h',
            cost: 'Free',
          },
          {
            time: '12:00',
            name: 'Sapporo Central Market Lunch',
            notes: 'ตลาดปลาสดซัปโปโร ซูชิ + ไข่ปลาแซลมอน',
            priority: 'optional',
            category: 'food',
            cost: '¥2,000-3,000',
          },
          {
            time: '15:00',
            name: 'Departure from New Chitose Airport',
            notes: 'เผื่อเวลา 2 ชม. ก่อนเครื่องบิน — check-in + ช้อปปิ้งในสนามบิน',
            priority: 'mandatory',
            category: 'flight',
          },
        ],
        accommodation: 'เดินทางกลับ',
        transport: 'JR Rapid Airport ซัปโปโร→สนามบิน (37 min, ¥1,150)',
        transportNotes: 'สนามบิน New Chitose มีร้าน Royce Chocolate + ราเมนซอยสนามบิน',
      },
    ],
  },
  {
    slug: 'kyoto-cultural-immersion',
    title: 'Kyoto Cultural Immersion',
    totalDays: 4,
    season: 'Spring',
    coverImage: 'stock2',
    description:
      'ดื่มด่ำวัฒนธรรมญี่ปุ่นแท้ๆ ที่เกียวโต ชมซากุระบาน เยี่ยมวัดเก่าแก่ และสัมผัสชีวิตเกอิชาในย่านกิออง',
    days: [
      {
        day: 1,
        location: 'Kyoto',
        activities: [
          {
            time: '06:00',
            name: 'Arrive at Kansai Airport (KIX) / Tokyo Station',
            notes: 'ถ้าบินตรง: ลง KIX → Haruka Express สู่เกียวโต (1h15m) · ถ้ามาจากโตเกียว: Shinkansen จาก Tokyo Station (2h15m Nozomi / 2h40m Hikari)',
            priority: 'mandatory',
            category: 'flight',
            duration: '1-2.5h',
          },
          {
            time: '10:00',
            name: "Philosopher's Path Cherry Blossoms",
            notes: 'ซากุระบานสวยสุดช่วงต้น April เดินทางริมคลอง 2 กม.',
            priority: 'recommended',
            category: 'sightseeing',
            duration: '1.5h',
            cost: 'Free',
          },
          {
            time: '13:00',
            name: 'Nanzen-ji Temple Complex',
            notes: 'วัดเซนขนาดใหญ่ + ท่อส่งน้ำสไตล์โรมัน (อยู่ปลายทาง Philosopher\'s Path)',
            priority: 'optional',
            category: 'sightseeing',
            duration: '1h',
            cost: '¥600',
          },
          {
            time: '15:30',
            name: 'Heian Shrine & Garden',
            notes: 'ศาลเจ้าสีแดงขนาดใหญ่ สวนด้านหลังสวยมากช่วงซากุระ',
            priority: 'optional',
            category: 'sightseeing',
            duration: '1h',
            cost: '¥600 (สวน)',
          },
        ],
        choices: [
          {
            label: 'อาหารเย็นเกียวโต · Dinner in Kyoto',
            priority: 'optional',
            category: 'food',
            options: [
              { time: '19:00', name: 'Pontocho Alley (先斗町)', notes: 'ซอยริมแม่น้ำคาโม หลายร้านให้เลือก บรรยากาศดี', cost: '¥2,000-5,000', category: 'food' },
              { time: '19:00', name: 'Nishiki Warai', notes: 'โอโกโนมิยากิสไตล์เกียวโต ใกล้ตลาดนิชิกิ', cost: '¥1,500', category: 'food' },
              { time: '19:00', name: 'Gogyo Ramen', notes: 'ราเมนไหม้ (Kogashi Miso) เอกลักษณ์ของเกียวโต', cost: '¥1,200', category: 'food' },
            ],
          },
        ],
        accommodation: 'The Westin Miyako Kyoto',
        transport: 'Shinkansen จากโตเกียว (2h15m) หรือ Airport Limousine จาก KIX (1h15m)',
        transportNotes: 'ถ้ามี JR Pass ใช้ Shinkansen Nozomi ไม่ได้ ต้องนั่ง Hikari แทน (2h40m)',
      },
      {
        day: 2,
        location: 'Kyoto',
        activities: [
          {
            time: '07:00',
            name: 'Fushimi Inari Pre-Dawn Hike',
            notes: 'ไปก่อน 8 โมงจะได้ถ่ายรูปเสาโทริอิไม่มีคน ขึ้นยอดเขา 2-3 ชม.',
            priority: 'recommended',
            category: 'sightseeing',
            duration: '2.5h',
            cost: 'Free',
          },
          {
            time: '11:00',
            name: 'Tofuku-ji Garden',
            notes: 'สวนหินเซนที่สวยที่สุดแห่งหนึ่ง ใบไม้เขียวสดในฤดูใบไม้ผลิ',
            priority: 'optional',
            category: 'sightseeing',
            duration: '1h',
            cost: '¥500',
          },
          {
            time: '14:00',
            name: 'Nishiki Market Tasting Tour',
            notes: 'ตลาดครัวของเกียวโต 400+ ปี ชิมอาหารท้องถิ่น',
            priority: 'recommended',
            category: 'food',
            duration: '1.5h',
            cost: '¥1,000-2,000 (ค่าชิม)',
          },
          {
            time: '17:00',
            name: 'Gion District Evening Walk',
            notes: 'เดินชมย่านเกอิชา อาจเจอไมโกะเดินผ่าน',
            priority: 'recommended',
            category: 'sightseeing',
            duration: '1.5h',
            cost: 'Free',
          },
        ],
        accommodation: 'The Westin Miyako Kyoto',
        transport: 'Kyoto City Bus 1-Day Pass (¥700)',
        transportNotes: 'ซื้อบัตร 1-Day Pass ที่สถานีหรือบนรถบัส ใช้ได้ไม่จำกัดเที่ยว',
      },
      {
        day: 3,
        location: 'Kyoto',
        activities: [
          {
            time: '08:00',
            name: 'Arashiyama Bamboo Grove & Togetsukyo Bridge',
            notes: 'ป่าไผ่ที่โด่งดังที่สุดในญี่ปุ่น ไปเช้ามากเพื่อหลีกเลี่ยงฝูงชน',
            priority: 'recommended',
            category: 'sightseeing',
            duration: '1.5h',
            cost: 'Free',
          },
          {
            time: '11:00',
            name: 'Tenryu-ji Zen Garden',
            notes: 'วัดมรดกโลก UNESCO สวนเซนอายุ 700 ปี',
            priority: 'recommended',
            category: 'sightseeing',
            duration: '1h',
            cost: '¥500',
          },
          {
            time: '14:00',
            name: 'Kinkaku-ji Golden Pavilion',
            notes: 'วัดทอง ไอคอนของเกียวโต',
            priority: 'recommended',
            category: 'sightseeing',
            duration: '1h',
            cost: '¥500',
          },
          {
            time: '17:00',
            name: 'Ryoan-ji Rock Garden',
            notes: 'สวนหินที่โด่งดังที่สุดในโลก 15 ก้อนหิน',
            priority: 'optional',
            category: 'sightseeing',
            duration: '45min',
            cost: '¥500',
          },
        ],
        choices: [
          {
            label: 'อาหารกลางวันอาราชิยามะ · Lunch in Arashiyama',
            priority: 'optional',
            category: 'food',
            options: [
              { time: '12:30', name: 'Yudofu Sagano', notes: 'เต้าหู้ต้มร้อนสไตล์เกียวโต อาหารวัดแบบดั้งเดิม', cost: '¥3,000', category: 'food' },
              { time: '12:30', name: 'Arashiyama Yoshimura', notes: 'โซบะทำมือ วิวแม่น้ำโฮซุ', cost: '¥1,500', category: 'food' },
              { time: '12:30', name: '%Arabica Kyoto', notes: 'กาแฟชื่อดัง ร้านต้นกำเนิดริมแม่น้ำ + แซนด์วิช', cost: '¥800', category: 'food' },
            ],
          },
        ],
        accommodation: 'The Westin Miyako Kyoto',
        transport: 'Randen Tram (สายพิเศษผ่านอุโมงค์ซากุระ) + City Bus',
        transportNotes: 'Randen Tram จาก Shijo-Omiya → Arashiyama สวยมากช่วงซากุระ (¥250)',
      },
      {
        day: 4,
        location: 'Kyoto',
        activities: [
          {
            time: '09:00',
            name: 'Tea Ceremony Experience',
            notes: 'จองล่วงหน้าที่ Urasenke หรือ En — ใส่ชุดกิโมโนได้',
            priority: 'recommended',
            category: 'experience',
            duration: '1.5h',
            cost: '¥3,000-5,000',
          },
          {
            time: '12:00',
            name: 'Nijo Castle',
            notes: 'ปราสาทมรดกโลก พื้นนกร้อง (Nightingale Floor)',
            priority: 'optional',
            category: 'sightseeing',
            duration: '1.5h',
            cost: '¥800',
          },
          {
            time: '15:00',
            name: 'Kyoto Station Shopping (Isetan & Porta)',
            notes: 'ช้อปปิ้ง + ซื้อของฝาก ชั้น B2 มีขนมเกียวโตครบ',
            priority: 'optional',
            category: 'shopping',
            duration: '1.5h',
          },
          {
            time: '18:00',
            name: 'Departure from Kansai Airport (KIX)',
            notes: 'เผื่อเวลา 2 ชม.ก่อนเครื่องออก เช็คอินที่ Terminal 1 · ถ้า Shinkansen กลับโตเกียว เผื่อเวลา 3 ชม. (2h15m Nozomi + buffer)',
            priority: 'mandatory',
            category: 'flight',
            duration: '2h (buffer)',
          },
        ],
        accommodation: 'เดินทางกลับ',
        transport: 'Haruka Express เกียวโต→สนามบิน KIX (1h15m, ¥3,600)',
        transportNotes: 'ถ้ามี ICOCA & Haruka discount ticket จะถูกกว่า ซื้อล่วงหน้าที่ e5489.jr-odekake.net · ถ้านั่ง Shinkansen กลับโตเกียว ใช้ JR Kyoto Station ชั้น 2F',
      },
    ],
  },
] as const

async function main() {
  const systemUser = await prisma.user.upsert({
    where: { email: SYSTEM_USER_EMAIL },
    update: {},
    create: {
      email: SYSTEM_USER_EMAIL,
      name: 'Dopamichi System',
      role: 'USER',
    },
  })
  console.log(`✓ System user ready: ${systemUser.email}`)

  for (const t of TEMPLATES) {
    const id = `tmpl_${t.slug}`
    const itinerary = {
      title: t.title,
      totalDays: t.totalDays,
      season: t.season,
      days: t.days,
    }
    await prisma.template.upsert({
      where: { id },
      update: {
        title: t.title,
        description: t.description,
        totalDays: t.totalDays,
        season: t.season,
        coverImage: t.coverImage,
        itinerary,
        published: true,
      },
      create: {
        id,
        title: t.title,
        description: t.description,
        totalDays: t.totalDays,
        season: t.season,
        coverImage: t.coverImage,
        itinerary,
        published: true,
        createdById: systemUser.id,
      },
    })
    console.log(`✓ Template: ${t.title}`)
  }

  console.log(`\n✓ Seed complete — ${TEMPLATES.length} enriched templates`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
