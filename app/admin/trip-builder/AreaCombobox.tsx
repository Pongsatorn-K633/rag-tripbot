'use client'

import { useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

export interface JpArea { code: string; name: string; nameTh: string | null; type: string; regionCode: string | null }
const AREA_TYPE_TH: Record<string, string> = { prefecture: 'จังหวัด', region: 'ภูมิภาค', both: 'จังหวัด + ภูมิภาค' }

/** Self-contained JP-area combobox: fetches the areas, type-to-filter, click to pick.
 *  Emits the area `code` (the trip-code prefix, e.g. KYO). Used by the V3 create flow. */
export default function AreaCombobox({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [areas, setAreas] = useState<JpArea[]>([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [typing, setTyping] = useState(false)

  useEffect(() => {
    fetch('/api/admin/jp-areas').then((r) => r.json()).then((d) => setAreas(d.areas ?? [])).catch(() => {})
  }, [])

  const q = query.trim().toLowerCase()
  const filtered = !typing || !q
    ? areas
    : areas.filter((a) => a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q) || (a.nameTh ?? '').includes(query.trim()))
  const picked = areas.find((a) => a.code === value)
  const closedLabel = picked ? `${picked.code} — ${picked.name}${picked.nameTh ? ` · ${picked.nameTh}` : ''}` : value

  function commit(a: JpArea) { onChange(a.code); setOpen(false); setTyping(false) }
  function openMenu(el?: HTMLInputElement | null) { setQuery(value); setTyping(false); setOpen(true); el?.select() }

  return (
    <div className="relative">
      <input
        value={open ? query : closedLabel}
        onFocus={(e) => openMenu(e.currentTarget)}
        onClick={(e) => { if (!open) openMenu(e.currentTarget) }}
        onChange={(e) => {
          setTyping(true)
          setQuery(e.target.value)
          const exact = areas.find((x) => x.code.toLowerCase() === e.target.value.trim().toLowerCase())
          onChange(exact ? exact.code : '')
        }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder="พิมพ์ค้นหา · จังหวัด/ภูมิภาค (ใช้ขึ้นต้นรหัสทริป)"
        className="w-full pl-3 pr-8 py-2 text-sm border border-zen-black/20 rounded-lg focus:outline-none focus:border-basel-brick bg-white"
      />
      <ChevronDown size={16} className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-zen-black/35 pointer-events-none transition-transform ${open ? 'rotate-180' : ''}`} />
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-zen-black/15 rounded-lg shadow-xl max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-zen-black/40">ไม่พบจังหวัด/ภูมิภาค</div>
          ) : (
            filtered.map((a) => (
              <button key={a.code} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => commit(a)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-briefing-cream ${a.code === value ? 'bg-briefing-cream/70' : ''}`}>
                <span className="font-mono font-bold text-basel-brick w-9 flex-shrink-0">{a.code}</span>
                <span className="flex-1 truncate text-zen-black">{a.name}{a.nameTh ? ` · ${a.nameTh}` : ''}</span>
                <span className="text-[10px] text-zen-black/40 flex-shrink-0">{AREA_TYPE_TH[a.type] ?? a.type}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
