import type { ItineraryV3 } from '@/lib/itinerary-types'

/**
 * Reshape a stored {@link ItineraryV3} → the authoring JSON shape (the same shape the
 * transformer emits / docs/pre-planned-trip/columns.md). Top-level app-compat fields
 * (version/totalDays/title/airports) are derived on import, so we omit them here — the
 * file you download is exactly what you hand-edit and re-import.
 */
export function toAuthoringJson(itin: ItineraryV3) {
  return {
    source_file: itin.sourceFile ?? null,
    overview: itin.overview,
    highlights: itin.highlights ?? [],
    reference_date: itin.reference_date ?? null,
    days: itin.days,
  }
}

/** A blank V3 plan to fill in from scratch (replaces the old blank Excel template). */
export function blankPlanJson(days = 7) {
  return {
    source_file: null,
    overview: {
      title: '',
      cover_tagline: '',
      description: '',
      available_period: { primary: '', details: '' },
      recommended_period: [{ primary: '', details: '' }],
      area_code: '',
      cover_images: [],
      available_airports: { major_hubs: [{ name: '', code: '' }] },
      car_rental: { primary: 'N', details: {} },
      arrival_to_first_act_hrs: null,
      arrival_to_departure_airport_hrs: null,
      logistic_guide_th: '', food_guide_th: '', accommodation_guide_th: '', queue_guide_th: '', remark_th: '',
    },
    highlights: [{ name: '', description: '', level: '⭐' }],
    days: Array.from({ length: days }, (_, i) => ({
      day: i + 1,
      name: { en: '', th: '' },
      activities: [
        { slot: 'Activity 1', time: '', name: { en: '', th: '' }, description: { en: '', th: '' }, location: '', cost: null, priority: 'Normal' },
      ],
    })),
  }
}

/** Trigger a browser download of an object as pretty-printed JSON. Client-only. */
export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.json') ? filename : `${filename}.json`
  a.click()
  URL.revokeObjectURL(url)
}
