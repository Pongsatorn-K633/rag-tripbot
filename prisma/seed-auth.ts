/**
 * Seeds the initial templates into the Template table, owned by a reserved
 * "system" user. Idempotent — safe to re-run.
 *
 *   npx tsx prisma/seed-auth.ts
 *
 * Why a system user:
 * We use `allowDangerousEmailAccountLinking: false` (Google and Resend do NOT
 * share the same User row). If we seeded a real email here, the first Google
 * sign-in with that email would hit `OAuthAccountNotLinked` because the row
 * would already exist without a linked Account. The system user has a fake
 * address (`system@dopamichi.local`) that no one can ever actually sign into,
 * so it will never collide with a real OAuth / magic-link sign-in.
 *
 * Superadmin bootstrap is handled entirely by `events.createUser` in
 * `lib/auth.ts` — emails listed in SUPERADMIN_EMAILS get promoted to
 * SUPERADMIN on their very first sign-in, no seeding required.
 *
 * The 4 templates mirror the previously-hardcoded TEMPLATES array in
 * app/templates/page.tsx. Once this seed runs, `app/templates/page.tsx` should
 * fetch from `/api/templates` instead of using its local const.
 */
import { prisma } from '../lib/db'
import { IMG } from '../lib/images'

/** Reserved address that no real user can sign in with. */
const SYSTEM_USER_EMAIL = 'system@dopamichi.local'

const TEMPLATES = [
  {
    slug: 'tokyo-osaka-classic',
    title: 'Tokyo & Osaka Classic',
    totalDays: 7,
    season: 'Winter',
    coverImage: IMG.stock1,
    description:
      'เส้นทางยอดนิยม โตเกียว → เกียวโต → โอซาก้า ครบทุกไฮไลต์ ตั้งแต่วัดเก่าแก่จนถึงย่านช้อปปิ้งสุดฮิต',
    days: [
      {
        day: 1,
        location: 'Tokyo',
        activities: [
          { time: '10:00', name: 'Senso-ji Temple, Asakusa', notes: 'มาเช้าหลีกเลี่ยงฝูงชน' },
          { time: '14:00', name: 'Akihabara Electric Town', notes: 'ช้อปปิ้งสินค้าอิเล็กทรอนิกส์' },
          { time: '18:00', name: 'Shibuya Crossing & Dinner', notes: 'ชมสี่แยกชิบุย่าตอนค่ำ' },
        ],
        accommodation: 'Hotel Gracery Shinjuku',
        transport: 'Narita Express จากสนามบิน',
      },
      {
        day: 2,
        location: 'Tokyo',
        activities: [
          { time: '09:00', name: 'Tsukiji Outer Market', notes: 'อาหารเช้าซูชิสด' },
          { time: '12:00', name: 'teamLab Planets', notes: 'จองล่วงหน้าออนไลน์' },
          { time: '16:00', name: 'Odaiba Waterfront' },
        ],
        accommodation: 'Hotel Gracery Shinjuku',
        transport: 'Tokyo Metro Day Pass',
      },
      {
        day: 3,
        location: 'Tokyo',
        activities: [
          { time: '09:00', name: 'Harajuku & Takeshita Street' },
          { time: '12:00', name: 'Meiji Shrine' },
          { time: '15:00', name: 'Omotesando Shopping' },
        ],
        accommodation: 'Hotel Gracery Shinjuku',
        transport: 'Yamanote Line',
      },
      {
        day: 4,
        location: 'Kyoto',
        activities: [
          { time: '09:00', name: 'Fushimi Inari Shrine', notes: 'ไปเช้ามากเพื่อความเงียบสงบ' },
          { time: '14:00', name: 'Nishiki Market', notes: 'ตลาดสดของเกียวโต' },
          { time: '17:00', name: 'Gion District Evening Walk' },
        ],
        accommodation: 'Kyoto Machiya Inn',
        transport: 'Shinkansen Nozomi โตเกียว→เกียวโต',
      },
      {
        day: 5,
        location: 'Kyoto',
        activities: [
          { time: '08:00', name: 'Arashiyama Bamboo Grove', notes: 'ไปก่อน 9 โมงหลีกฝูงชน' },
          { time: '11:00', name: 'Tenryu-ji Garden' },
          { time: '15:00', name: 'Kinkaku-ji (Golden Pavilion)' },
        ],
        accommodation: 'Kyoto Machiya Inn',
        transport: 'Sagano Scenic Railway',
      },
      {
        day: 6,
        location: 'Osaka',
        activities: [
          { time: '10:00', name: 'Osaka Castle & Park' },
          { time: '14:00', name: 'Dotonbori Street Food Tour', notes: 'ชิมทาโกะยากิและโอโกโนมิยากิ' },
          { time: '19:00', name: 'Namba Night Shopping' },
        ],
        accommodation: 'Cross Hotel Osaka',
        transport: 'Hankyu Line เกียวโต→โอซาก้า',
      },
      {
        day: 7,
        location: 'Osaka',
        activities: [
          { time: '09:00', name: 'Kuromon Market Breakfast' },
          { time: '11:00', name: 'Shinsekai & Tsutenkaku Tower' },
          { time: '15:00', name: 'Departure from Kansai Airport' },
        ],
        accommodation: 'เดินทางกลับ',
        transport: 'Nankai Railway สู่สนามบินคันไซ',
      },
    ],
  },
  {
    slug: 'hokkaido-snow-adventure',
    title: 'Hokkaido Snow Adventure',
    totalDays: 5,
    season: 'Winter',
    coverImage: IMG.stock3,
    description:
      'ผจญภัยหิมะที่ฮอกไกโด สัมผัสเทศกาลหิมะซัปโปโร เล่นสกีที่นิเซโกะ และบรรยากาศเมืองริมทะเลโอทารุ',
    days: [
      {
        day: 1,
        location: 'Sapporo',
        activities: [
          { time: '11:00', name: 'Sapporo Beer Museum' },
          { time: '14:00', name: 'Odori Park Snow Festival Site', notes: 'ช่วง Feb มีเทศกาลหิมะ' },
          { time: '18:00', name: 'Susukino Ramen Village', notes: 'ราเมนซัปโปโรต้นตำรับ' },
        ],
        accommodation: 'JR Tower Hotel Nikko Sapporo',
        transport: 'New Chitose Airport Express',
      },
      {
        day: 2,
        location: 'Otaru',
        activities: [
          { time: '09:00', name: 'Otaru Canal Morning Walk' },
          { time: '11:00', name: 'Sakaimachi Street Glass Shops' },
          { time: '13:00', name: 'Fresh Sushi at Otaru Sushi Street' },
        ],
        accommodation: 'JR Tower Hotel Nikko Sapporo',
        transport: 'JR Hakodate Line ซัปโปโร→โอทารุ 40 นาที',
      },
      {
        day: 3,
        location: 'Niseko',
        activities: [
          { time: '08:00', name: 'Niseko United Ski Resort', notes: 'รวม 4 รีสอร์ตสกีขนาดใหญ่' },
          { time: '12:00', name: 'Lunch at Grand Hirafu Village' },
          { time: '16:00', name: 'Onsen after Skiing', notes: 'น้ำพุร้อนช่วยฟื้นฟูกล้ามเนื้อ' },
        ],
        accommodation: 'Hilton Niseko Village',
        transport: 'Hokkaido Liner Bus ซัปโปโร→นิเซโกะ',
      },
      {
        day: 4,
        location: 'Niseko',
        activities: [
          { time: '08:00', name: 'Morning Powder Ski Run', notes: 'หิมะผงนิเซโกะชื่อดังระดับโลก' },
          { time: '13:00', name: 'Snowshoeing Tour' },
          { time: '17:00', name: 'Mt. Yotei View Sunset' },
        ],
        accommodation: 'Hilton Niseko Village',
        transport: 'ใช้ Shuttle Bus ภายในรีสอร์ต',
      },
      {
        day: 5,
        location: 'Sapporo',
        activities: [
          { time: '09:00', name: 'Moerenuma Park (Isamu Noguchi)' },
          { time: '12:00', name: 'Sapporo Central Market Lunch' },
          { time: '15:00', name: 'Departure from New Chitose Airport' },
        ],
        accommodation: 'เดินทางกลับ',
        transport: 'JR Limited Express สู่สนามบิน',
      },
    ],
  },
  {
    slug: 'kyoto-cultural-immersion',
    title: 'Kyoto Cultural Immersion',
    totalDays: 4,
    season: 'Spring',
    coverImage: IMG.stock2,
    description:
      'ดื่มด่ำวัฒนธรรมญี่ปุ่นแท้ๆ ที่เกียวโต ชมซากุระบาน เยี่ยมวัดเก่าแก่ และสัมผัสชีวิตเกอิชาในย่านกิออง',
    days: [
      {
        day: 1,
        location: 'Kyoto',
        activities: [
          { time: '08:00', name: "Philosopher's Path Cherry Blossoms", notes: 'ซากุระบานสวยสุดช่วงต้น April' },
          { time: '11:00', name: 'Nanzen-ji Temple Complex' },
          { time: '15:00', name: 'Heian Shrine & Garden' },
          { time: '19:00', name: 'Pontocho Alley Dinner' },
        ],
        accommodation: 'The Westin Miyako Kyoto',
        transport: 'Shinkansen จากโตเกียว หรือ Airport Limousine จาก KIX',
      },
      {
        day: 2,
        location: 'Kyoto',
        activities: [
          { time: '07:00', name: 'Fushimi Inari Pre-Dawn Hike', notes: 'ก่อนนักท่องเที่ยวมา' },
          { time: '11:00', name: 'Tofuku-ji Garden', notes: 'แมปเปิลสวยในฤดูใบไม้ร่วง ช่วงนี้ใบไม้เขียว' },
          { time: '14:00', name: 'Nishiki Market Tasting Tour' },
          { time: '17:00', name: 'Gion Geisha Spotting Walk' },
        ],
        accommodation: 'The Westin Miyako Kyoto',
        transport: 'Kyoto City Bus 1-Day Pass',
      },
      {
        day: 3,
        location: 'Kyoto',
        activities: [
          { time: '08:00', name: 'Arashiyama Bamboo Grove & Togetsukyo Bridge' },
          { time: '11:00', name: 'Tenryu-ji Zen Garden' },
          { time: '14:00', name: 'Kinkaku-ji Golden Pavilion' },
          { time: '17:00', name: 'Ryoan-ji Rock Garden', notes: 'วัดสวนหินอันโด่งดัง' },
        ],
        accommodation: 'The Westin Miyako Kyoto',
        transport: 'Randen Tram + City Bus',
      },
      {
        day: 4,
        location: 'Kyoto',
        activities: [
          { time: '09:00', name: 'Tea Ceremony Experience', notes: 'จองล่วงหน้าที่ Urasenke หรือ En' },
          { time: '12:00', name: 'Nijo Castle' },
          { time: '15:00', name: 'Kyoto Station Shopping (Isetan & Porta)' },
          { time: '18:00', name: 'Departure' },
        ],
        accommodation: 'เดินทางกลับ',
        transport: 'Shinkansen หรือ Haruka Express สู่สนามบิน KIX',
      },
    ],
  },
  {
    slug: 'tokyo-summer-explorer',
    title: 'Tokyo Summer Explorer',
    totalDays: 6,
    season: 'Summer',
    coverImage: IMG.stock4,
    description:
      'สำรวจโตเกียวในฤดูร้อน เทศกาลฮานาบิ ชุดยูกาตะ สวนสนุก และเดย์ทริปสู่นิกโกะและคามาคุระ',
    days: [
      {
        day: 1,
        location: 'Tokyo',
        activities: [
          { time: '10:00', name: 'Senso-ji & Nakamise Shopping Street' },
          { time: '14:00', name: 'Tokyo Skytree Observatory' },
          { time: '19:00', name: 'Sumida River Fireworks (Hanabi)', notes: 'ช่วง late July มีเทศกาลดอกไม้ไฟ' },
        ],
        accommodation: 'Hyatt Regency Tokyo',
        transport: 'Narita/Haneda Express',
      },
      {
        day: 2,
        location: 'Tokyo',
        activities: [
          { time: '08:00', name: 'Tsukiji Morning Fish Market' },
          { time: '11:00', name: 'Hamarikyu Garden', notes: 'สวนดอกไม้ริมน้ำสวยมากในฤดูร้อน' },
          { time: '15:00', name: 'teamLab Planets Toyosu' },
          { time: '19:00', name: 'Odaiba Yukata Stroll & Dinner' },
        ],
        accommodation: 'Hyatt Regency Tokyo',
        transport: 'Tokyo Metro + Yurikamome Line',
      },
      {
        day: 3,
        location: 'Nikko',
        activities: [
          { time: '09:00', name: 'Tosho-gu Shrine Complex', notes: 'มรดกโลก UNESCO ประดับทองอลังการ' },
          { time: '12:00', name: 'Shinkyo Sacred Bridge' },
          { time: '14:00', name: 'Kegon Waterfall', notes: 'น้ำตกที่สวยที่สุดของญี่ปุ่น' },
        ],
        accommodation: 'Hyatt Regency Tokyo',
        transport: 'Tobu Nikko Line เดย์ทริปจากโตเกียว',
      },
      {
        day: 4,
        location: 'Kamakura',
        activities: [
          { time: '09:00', name: 'Kotoku-in Great Buddha', notes: 'พระพุทธรูปสำริดยักษ์ขนาดใหญ่' },
          { time: '11:00', name: 'Hase-dera Temple & Hydrangeas', notes: 'ดอกไฮเดรนเยียบานในฤดูร้อน' },
          { time: '14:00', name: 'Yuigahama Beach', notes: 'ชายหาดยอดนิยมของโตเกียวอาน' },
        ],
        accommodation: 'Hyatt Regency Tokyo',
        transport: 'JR Yokosuka Line จากโตเกียว',
      },
      {
        day: 5,
        location: 'Tokyo',
        activities: [
          { time: '10:00', name: 'Shinjuku Gyoen Garden' },
          { time: '13:00', name: 'Harajuku Takeshita Street & Crepes' },
          { time: '16:00', name: 'Shibuya 109 Shopping' },
          { time: '20:00', name: 'Omoide Yokocho Night Izakaya' },
        ],
        accommodation: 'Hyatt Regency Tokyo',
        transport: 'Yamanote Line',
      },
      {
        day: 6,
        location: 'Tokyo',
        activities: [
          { time: '09:00', name: 'Akihabara Electronics & Anime' },
          { time: '12:00', name: 'Ueno Park & Tokyo National Museum' },
          { time: '15:00', name: 'Duty-Free Shopping at Narita' },
        ],
        accommodation: 'เดินทางกลับ',
        transport: 'Narita Express สู่สนามบิน',
      },
    ],
  },
] as const

async function main() {
  // 1. Ensure the reserved system user exists. Templates are owned by this row.
  //    The email is a fake `.local` domain so it can never collide with a real
  //    Google / magic-link sign-in.
  const systemUser = await prisma.user.upsert({
    where: { email: SYSTEM_USER_EMAIL },
    update: {},
    create: {
      email: SYSTEM_USER_EMAIL,
      name: 'Dopamichi System',
      role: 'USER', // intentionally NOT superadmin — this row is not a login
    },
  })
  console.log(`✓ System user ready: ${systemUser.email}`)

  // 2. Seed the 4 templates idempotently. We use stable IDs based on slug so
  //    re-running the seed updates existing rows instead of duplicating.
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

  console.log(`\n✓ Seed complete — ${TEMPLATES.length} templates owned by system user`)
  console.log(`  Superadmin bootstrap: sign in with an email in SUPERADMIN_EMAILS`)
  console.log(`  to be promoted automatically via events.createUser in lib/auth.ts`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
