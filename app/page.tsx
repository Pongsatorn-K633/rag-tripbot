'use client'

import Link from 'next/link'
import { MessageSquare, BookOpen, Upload, ArrowRight, Compass } from 'lucide-react'
import { motion } from 'motion/react'
import { IMG } from '@/lib/images'

export default function Home() {
  return (
    <main className="pt-32">
      {/* Hero Section */}
      <section className="px-8 py-20 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="z-10"
          >
            <h1 className="text-6xl md:text-8xl font-headline font-extrabold tracking-tight leading-[1] mb-12 uppercase">
              Travel<br /><span className="text-basel-brick">Refined.</span>
            </h1>
            <p className="text-xl md:text-2xl text-zen-black font-medium leading-relaxed max-w-lg mb-12">
              วางแผนเที่ยวญี่ปุ่นผ่าน AI ที่ออกแบบมาเพื่อความเรียบง่ายและแม่นยำที่สุด
            </p>
            <div className="flex flex-wrap gap-6">
              <a
                href="#pathways"
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById('pathways')?.scrollIntoView({ behavior: 'smooth' })
                }}
                className="px-10 py-5 bg-basel-brick text-briefing-cream font-bold text-xl hover:bg-zen-black transition-colors duration-300 cursor-pointer"
              >
                START JOURNEY
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1 }}
            className="relative"
          >
            <div className="aspect-square bg-zen-black overflow-hidden grayscale contrast-125">
              <img
                alt="Japanese Aesthetic"
                className="w-full h-full object-cover opacity-80"
                src={IMG.homeHero}
              />
            </div>
            <div className="absolute -bottom-4 -left-4 bg-basel-brick text-briefing-cream px-6 py-4 font-bold text-sm tracking-widest uppercase">
              Zen Edition v.01
            </div>
          </motion.div>
        </div>
      </section>

      {/* Main Interaction Hub: Pathway Cards */}
      <section id="pathways" className="px-8 py-24 border-t border-zen-black/10 scroll-mt-24">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-zen-black">
            {/* Option A: Chat — UNDER MAINTENANCE (redirects to /maintenance) */}
            <Link
              href="/maintenance"
              className="group relative p-12 border-b md:border-b-0 md:border-r border-zen-black bg-zen-black/[0.03] hover:bg-zen-black/10 transition-all duration-300 cursor-not-allowed"
            >
              <div className="absolute top-4 right-4 bg-basel-brick text-white text-[9px] font-black uppercase tracking-widest px-2 py-1">
                Maintenance
              </div>
              <MessageSquare className="w-10 h-10 mb-8 opacity-40" strokeWidth={1.5} />
              <h3 className="text-3xl font-headline font-bold mb-6 opacity-50">วางแผนการเดินทาง</h3>
              <p className="mb-10 text-lg opacity-40">AI Concierge กำลังงีบอยู่ที่เกียวโต 🍵 เดี๋ยวตื่นมาจะรีบกลับมาช่วยวางแผนให้นะคะ</p>
              <div className="flex items-center font-bold uppercase tracking-widest text-sm opacity-50">
                <span>Temporarily Offline</span>
                <ArrowRight className="ml-2 w-4 h-4" />
              </div>
            </Link>

            {/* Option B: Templates */}
            <Link
              href="/templates"
              className="group p-12 border-b md:border-b-0 md:border-r border-zen-black hover:bg-basel-brick hover:text-briefing-cream transition-all duration-300 cursor-pointer"
            >
              <BookOpen className="w-10 h-10 mb-8" strokeWidth={1.5} />
              <h3 className="text-3xl font-headline font-bold mb-6">เลือกแพ็คเกจสำเร็จรูป</h3>
              <p className="mb-10 text-lg opacity-80">รวมแผนเที่ยวสุดฮิตที่คัดสรรมาแล้วจากกูรู พร้อมไปได้ทันที ปรับเปลี่ยนเล็กน้อยก็สมบูรณ์แบบ</p>
              <div className="flex items-center font-bold uppercase tracking-widest text-sm">
                <span>View Catalog</span>
                <ArrowRight className="ml-2 w-4 h-4" />
              </div>
            </Link>

            {/* Option C: Gallery (upload) */}
            <Link
              href="/gallery"
              className="group p-12 hover:bg-basel-brick hover:text-briefing-cream transition-all duration-300 cursor-pointer"
            >
              <Upload className="w-10 h-10 mb-8" strokeWidth={1.5} />
              <h3 className="text-3xl font-headline font-bold mb-6">มีแผนอยู่แล้ว? อัปโหลดที่นี่</h3>
              <p className="mb-10 text-lg opacity-80">เพียงอัปโหลดไฟล์ PDF หรือรูปภาพแผนเดิมของคุณ ให้ AI ช่วยวิเคราะห์ ปรับปรุง และจองตั๋วให้ง่ายขึ้น</p>
              <div className="flex items-center font-bold uppercase tracking-widest text-sm">
                <span>Upload File</span>
                <ArrowRight className="ml-2 w-4 h-4" />
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Content Preview Grid */}
      <section className="px-8 py-24 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-auto md:h-[500px]">
          <div className="md:col-span-2 relative bg-zen-black group overflow-hidden">
            <img
              alt="Tokyo"
              className="w-full h-full object-cover grayscale opacity-50 transition-all duration-700 group-hover:scale-105 group-hover:opacity-100 group-hover:grayscale-0"
              src={IMG.homeTokyo}
            />
            <div className="absolute inset-0 p-10 flex flex-col justify-end">
              <h4 className="text-briefing-cream text-4xl font-headline font-bold uppercase tracking-tight">Tokyo Nights</h4>
            </div>
          </div>

          <div className="md:col-span-2 grid grid-cols-2 gap-4">
            <div className="relative bg-zen-black group overflow-hidden">
              <img
                alt="Kyoto"
                className="w-full h-full object-cover grayscale opacity-50 group-hover:opacity-100 group-hover:grayscale-0 transition-all"
                src={IMG.homeKyoto}
              />
              <div className="absolute inset-0 p-6 flex flex-col justify-end">
                <h4 className="text-briefing-cream font-headline font-bold uppercase text-sm">Zen Heritage</h4>
              </div>
            </div>

            <div className="relative bg-zen-black group overflow-hidden">
              <img
                alt="Fuji"
                className="w-full h-full object-cover grayscale opacity-50 group-hover:opacity-100 group-hover:grayscale-0 transition-all"
                src={IMG.homeFuji}
              />
              <div className="absolute inset-0 p-6 flex flex-col justify-end">
                <h4 className="text-briefing-cream font-headline font-bold uppercase text-sm">The Peak</h4>
              </div>
            </div>

            <div className="col-span-2 bg-basel-brick flex flex-col items-center justify-center text-center p-8 text-briefing-cream">
              <Compass className="w-10 h-10 mb-2" strokeWidth={1.5} />
              <p className="font-headline font-bold text-2xl uppercase tracking-tighter">100K+ Explorers</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
