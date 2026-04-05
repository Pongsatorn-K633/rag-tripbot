'use client'

interface Activity {
  time: string
  name: string
  notes?: string
}

interface Day {
  day: number
  location: string
  activities: Activity[]
  accommodation: string
  transport: string
}

export interface Itinerary {
  title: string
  totalDays: number
  season: string
  days: Day[]
  shareCode: string | null
  description?: string
}

interface TemplateCardProps {
  template: Itinerary
  onSelect: () => void
}

const SEASON_LABELS: Record<string, string> = {
  Winter: 'ฤดูหนาว',
  Spring: 'ฤดูใบไม้ผลิ',
  Summer: 'ฤดูร้อน',
  Autumn: 'ฤดูใบไม้ร่วง',
}

export default function TemplateCard({ template, onSelect }: TemplateCardProps) {
  const uniqueLocations = Array.from(new Set(template.days.map((d) => d.location)))

  return (
    <div
      className="rounded-xl overflow-hidden shadow-lg flex flex-col"
      style={{ backgroundColor: '#1e3057', border: '1px solid #2a4070' }}
    >
      {/* Season badge + header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: '#c9a84c22', color: '#c9a84c', border: '1px solid #c9a84c55' }}
          >
            {SEASON_LABELS[template.season] ?? template.season}
          </span>
          <span className="text-xs" style={{ color: '#718096' }}>
            {template.totalDays} วัน
          </span>
        </div>

        <h3 className="text-base font-bold leading-snug mb-2" style={{ color: '#c9a84c' }}>
          {template.title}
        </h3>

        {template.description && (
          <p className="text-sm leading-relaxed mb-3" style={{ color: '#a0aec0' }}>
            {template.description}
          </p>
        )}
      </div>

      {/* Location chips */}
      <div className="px-5 pb-4 flex flex-wrap gap-2">
        {uniqueLocations.map((loc) => (
          <span
            key={loc}
            className="text-xs px-2 py-1 rounded-md"
            style={{ backgroundColor: '#1a2744', color: '#93c5fd' }}
          >
            {loc}
          </span>
        ))}
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid #2a4070' }} />

      {/* CTA */}
      <div className="px-5 py-4 mt-auto">
        <button
          onClick={onSelect}
          className="w-full py-3 rounded-lg font-semibold text-sm transition-opacity hover:opacity-90 active:opacity-80"
          style={{ backgroundColor: '#c9a84c', color: '#1a2744' }}
        >
          ใช้แพ็คเกจนี้
        </button>
      </div>
    </div>
  )
}
