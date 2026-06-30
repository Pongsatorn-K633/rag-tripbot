/**
 * Google Places API (New) wrapper for resolving venue data. Dormant until
 * GOOGLE_MAPS_API_KEY is set (+ billing enabled in Google Cloud). Server-only.
 * Docs: https://developers.google.com/maps/documentation/places/web-service/text-search
 */
const KEY = process.env.GOOGLE_MAPS_API_KEY ?? ''

export function mapsConfigured(): boolean {
  return !!KEY
}

export interface PlaceData {
  placeId: string
  displayName?: string
  formattedAddress?: string
  rating?: number
  openingHours?: string
  googleMapsUri?: string
  websiteUri?: string
  priceLevel?: string
  phone?: string
  lat?: number
  lng?: number
}

const FIELDS = ['id', 'displayName', 'formattedAddress', 'location', 'rating', 'regularOpeningHours', 'googleMapsUri', 'websiteUri', 'priceLevel', 'nationalPhoneNumber', 'businessStatus']
const DETAIL_MASK = FIELDS.join(',')
const SEARCH_MASK = FIELDS.map((f) => `places.${f}`).join(',')

interface RawPlace {
  id?: string
  displayName?: { text?: string }
  formattedAddress?: string
  rating?: number
  regularOpeningHours?: { weekdayDescriptions?: string[] }
  googleMapsUri?: string
  websiteUri?: string
  priceLevel?: string
  nationalPhoneNumber?: string
  location?: { latitude?: number; longitude?: number }
}

function mapPlace(p: RawPlace): PlaceData {
  return {
    placeId: p.id ?? '',
    displayName: p.displayName?.text,
    formattedAddress: p.formattedAddress,
    rating: typeof p.rating === 'number' ? p.rating : undefined,
    openingHours: p.regularOpeningHours?.weekdayDescriptions?.join('; '),
    googleMapsUri: p.googleMapsUri,
    websiteUri: p.websiteUri,
    priceLevel: p.priceLevel,
    phone: p.nationalPhoneNumber,
    lat: p.location?.latitude,
    lng: p.location?.longitude,
  }
}

/** Text Search → best matching place (region-biased to Japan). */
export async function findPlace(query: string): Promise<PlaceData | null> {
  if (!KEY) throw new Error('GOOGLE_MAPS_API_KEY not configured')
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': SEARCH_MASK },
    body: JSON.stringify({ textQuery: query, maxResultCount: 1, regionCode: 'JP' }),
  })
  if (!res.ok) throw new Error(`Places API ${res.status}: ${await res.text().catch(() => '')}`)
  const data = (await res.json()) as { places?: RawPlace[] }
  const p = data.places?.[0]
  return p ? mapPlace(p) : null
}

/** Place Details by placeId (for refreshing a previously-resolved venue). */
export async function getPlace(placeId: string): Promise<PlaceData | null> {
  if (!KEY) throw new Error('GOOGLE_MAPS_API_KEY not configured')
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: { 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': DETAIL_MASK },
  })
  if (!res.ok) throw new Error(`Places API ${res.status}`)
  return mapPlace((await res.json()) as RawPlace)
}
