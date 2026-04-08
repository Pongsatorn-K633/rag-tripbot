'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { useSession, signIn } from 'next-auth/react'
import { type Itinerary } from '@/app/components/TemplateCard'
import ItineraryCard from '@/app/components/ItineraryCard'
import ActivationBanner from '@/app/components/ActivationBanner'
import { IMG } from '@/lib/images'

// ── Japan stock images ───────────────────────────────────────────────────────

const TEMPLATE_IMAGES = [IMG.stock1, IMG.stock3, IMG.stock2, IMG.stock4]

// ── Curated template data ─────────────────────────────────────────────────────

const TEMPLATES: (Itinerary & { description: string })[] = [
  {
    title: 'Tokyo & Osaka Classic',
    totalDays: 7,
    season: 'Winter',
    shareCode: null,
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
    title: 'Hokkaido Snow Adventure',
    totalDays: 5,
    season: 'Winter',
    shareCode: null,
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
    title: 'Kyoto Cultural Immersion',
    totalDays: 4,
    season: 'Spring',
    shareCode: null,
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
    title: 'Tokyo Summer Explorer',
    totalDays: 6,
    season: 'Summer',
    shareCode: null,
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
]

// ── Page component ────────────────────────────────────────────────────────────

type SaveState = 'idle' | 'saving' | 'done'

export default function TemplatesPage() {
  const { data: session } = useSession()
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [shareCode, setShareCode] = useState<string | null>(null)
  const [startDate, setStartDate] = useState('')

  const selectedTemplate = selectedIndex !== null ? TEMPLATES[selectedIndex] : null

  async function handleConfirm() {
    if (!selectedTemplate) return

    // Guest gate — bounce to sign-in with callback back to /templates
    if (!session?.user) {
      signIn(undefined, { callbackUrl: '/templates' })
      return
    }

    setSaveState('saving')

    try {
      const saveRes = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: selectedTemplate.title,
          itinerary: selectedTemplate,
          source: 'template',
          startDate: startDate || undefined,
        }),
      })
      if (!saveRes.ok) throw new Error('Failed to save trip')
      const { trip } = await saveRes.json()

      const primaryCity = selectedTemplate.days[0]?.location ?? 'JPN'
      const activateRes = await fetch('/api/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId: trip.id, primaryCity }),
      })
      if (!activateRes.ok) throw new Error('Failed to generate share code')
      const { shareCode: code } = await activateRes.json()

      setShareCode(code)
      setSaveState('done')
    } catch (err) {
      console.error('Save error:', err)
      setSaveState('idle')
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    }
  }

  function handleClose() {
    setSelectedIndex(null)
    setSaveState('idle')
    setShareCode(null)
    setStartDate('')
  }

  return (
    <main className="pt-32 pb-24 px-6 max-w-7xl mx-auto">
      {/* Hero header */}
      <header className="mb-20">
        <h1 className="text-5xl md:text-7xl font-headline font-extrabold tracking-tighter text-basel-brick mb-6">
          Template Gallery
        </h1>
        <p className="text-zen-black/70 text-lg max-w-2xl leading-relaxed font-sans">
          เลือกแผนการเดินทางที่คัดสรรแล้ว แล้วปรับแต่งตามต้องการได้เลย
        </p>
        <p className="text-zen-black/40 text-sm mt-1 font-sans">
          Curated Japan itineraries — pick one and make it yours
        </p>
      </header>

      {/* Section header */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6 border-b-2 border-zen-black/5 pb-8">
        <div>
          <span className="text-basel-brick font-extrabold text-sm uppercase tracking-[0.3em] mb-4 block font-headline">Curated Collections</span>
          <h2 className="text-5xl font-headline font-black tracking-tighter text-zen-black">แพ็คเกจสำเร็จรูป</h2>
        </div>
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
        {TEMPLATES.map((tpl, idx) => (
          <motion.div
            key={idx}
            whileHover={{ y: -10 }}
            className="group flex flex-col bg-white p-4 rounded-xl shadow-sm hover:shadow-2xl transition-all duration-300 cursor-pointer"
            onClick={() => {
              setSelectedIndex(idx)
              setSaveState('idle')
              setShareCode(null)
            }}
          >
            <div className="relative aspect-[4/5] overflow-hidden mb-6 bg-briefing-cream rounded-lg">
              <img
                alt={tpl.title}
                className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105"
                src={TEMPLATE_IMAGES[idx]}
              />
              <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-zen-black/80 to-transparent">
                <span className="bg-basel-brick text-briefing-cream px-3 py-1 text-[10px] font-black uppercase tracking-widest font-headline">
                  {tpl.totalDays} DAYS
                </span>
              </div>
            </div>
            <h3 className="text-2xl font-headline font-bold text-zen-black mb-2">{tpl.title}</h3>
            <p className="text-zen-black/60 text-sm font-sans leading-relaxed mb-4">{tpl.description}</p>
            <button className="mt-auto text-basel-brick font-black text-xs uppercase tracking-widest flex items-center gap-2 group-hover:translate-x-2 transition-transform font-headline">
              PREVIEW <ArrowRight size={14} />
            </button>
          </motion.div>
        ))}
      </div>

      {/* Modal overlay */}
      {selectedTemplate && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10 px-4"
          style={{ backgroundColor: 'rgba(35,26,14,0.75)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget && saveState !== 'saving') handleClose()
          }}
        >
          <div className="w-full max-w-lg bg-briefing-cream border border-zen-black/10 shadow-2xl overflow-hidden">
            {/* Modal header */}
            <div className="px-6 py-5 flex items-center justify-between border-b border-zen-black/10">
              <h2 className="font-headline font-black text-xl tracking-tighter text-zen-black">
                ยืนยันแผนการเดินทาง
              </h2>
              {saveState !== 'saving' && (
                <button
                  onClick={handleClose}
                  className="text-zen-black/40 hover:text-zen-black text-2xl leading-none transition-colors"
                  aria-label="ปิด"
                >
                  &times;
                </button>
              )}
            </div>

            {/* Modal body */}
            <div className="px-4 py-4">
              {saveState === 'done' && shareCode ? (
                <>
                  <ActivationBanner shareCode={shareCode} />
                  <button
                    onClick={handleClose}
                    className="mt-4 w-full py-4 border border-zen-black/20 font-headline font-bold text-sm uppercase tracking-widest text-zen-black/60 hover:bg-zen-black hover:text-briefing-cream transition-all"
                  >
                    เลือกแพ็คเกจอื่น
                  </button>
                </>
              ) : (
                <>
                  <div className="mb-4 px-1">
                    <label className="block text-xs font-bold uppercase tracking-widest text-basel-brick mb-1">
                      วันเริ่มเดินทาง (ไม่ระบุก็ได้)
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      disabled={saveState === 'saving'}
                      className="w-full bg-briefing-cream border border-zen-black/20 px-4 py-3 font-medium text-sm text-zen-black focus:outline-none focus:border-basel-brick transition-colors disabled:opacity-40"
                    />
                  </div>
                  <ItineraryCard
                    itinerary={selectedTemplate}
                    onConfirm={handleConfirm}
                    confirmLoading={saveState === 'saving'}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
