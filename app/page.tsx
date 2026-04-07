import Link from 'next/link'

export default function Home() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: '#1a2744' }}
    >
      {/* Logo / Brand mark */}
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold mb-8 shadow-lg"
        style={{ backgroundColor: '#c9a84c', color: '#1a2744' }}
      >
        RT
      </div>

      {/* Headline */}
      <h1
        className="text-4xl font-bold text-center mb-3 tracking-tight"
        style={{ color: '#c9a84c' }}
      >
        RAG TripBot
      </h1>
      <p
        className="text-center text-base max-w-sm leading-relaxed mb-2"
        style={{ color: '#a0aec0' }}
      >
        ผู้ช่วยวางแผนเที่ยวญี่ปุ่นสำหรับนักเดินทางชาวไทย
      </p>
      <p
        className="text-center text-sm max-w-xs leading-relaxed mb-5"
        style={{ color: '#718096' }}
      >
        Japan trip planning assistant for Thai travelers — powered by AI
      </p>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full max-w-xs">
        <div
          aria-disabled="true"
          title="อยู่ระหว่างการปรับปรุง"
          className="flex-1 text-center rounded-xl py-2 font-semibold text-sm cursor-not-allowed relative"
          style={{
            backgroundColor: 'transparent',
            color: '#4a5568',
            border: '1px dashed #4a5568',
          }}
        >
          วางแผนการเดินทาง
          {/* <span className="block text-[10px] font-normal mt-1" style={{ color: '#4a5568' }}>
            อยู่ระหว่างการปรับปรุง
          </span> */}
        </div>
        <Link
          href="/templates"
          className="flex-1 text-center rounded-xl py-2 font-semibold text-sm transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#c9a84c', color: '#1a2744' }}
        >
          เลือกแพ็คเกจสำเร็จรูป
        </Link>
      </div>

      {/* Secondary CTA — upload existing itinerary */}
      <Link
        href="/upload"
        className="mt-4 text-sm font-medium transition-opacity hover:opacity-70"
        style={{ color: '#718096' }}
      >
        มีแผนอยู่แล้ว? อัปโหลดที่นี่ &rarr;
      </Link>

      {/* Footer note */}
      <p className="mt-16 text-xs" style={{ color: '#4a5568' }}>
        Go Go ~
      </p>
    </main>
  )
}
