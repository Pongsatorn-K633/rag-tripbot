import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/authz'
import { findPlace, getPlace, mapsConfigured } from '@/lib/maps/places'
import { mapsBudget, apiRateLimit, checkLimit } from '@/lib/rate-limit'

/**
 * POST /api/admin/maps — resolve a venue via Google Places (New).
 * Body: { query?: string, placeId?: string } → { place, configured } | { configured:false }.
 * Returns configured:false (200) when GOOGLE_MAPS_API_KEY isn't set, so the UI can
 * show a friendly "add the key" hint instead of erroring.
 */
export async function POST(req: NextRequest) {
  let session
  try {
    session = await requireAdmin()
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }

  // Per-admin throttle (30/min) so one account can't drain the shared monthly budget.
  const perUser = await checkLimit(apiRateLimit, `maps:${session.user.id}`)
  if (!perUser.success) return NextResponse.json({ error: 'ใช้งานบ่อยเกินไป ลองใหม่อีกครั้ง' }, { status: 429 })

  if (!mapsConfigured()) {
    return NextResponse.json({ configured: false, error: 'ยังไม่ได้ตั้งค่า GOOGLE_MAPS_API_KEY' })
  }

  let query: string | undefined
  let placeId: string | undefined
  try {
    const body = await req.json()
    query = typeof body.query === 'string' ? body.query.trim() : undefined
    placeId = typeof body.placeId === 'string' ? body.placeId.trim() : undefined
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  if (!query && !placeId) return NextResponse.json({ error: 'query or placeId required' }, { status: 400 })

  // Monthly free-tier budget — stop before crossing 10K/month (keeps Places free).
  const { success } = await checkLimit(mapsBudget, 'budget')
  if (!success) {
    return NextResponse.json(
      { capped: true, error: 'ใช้โควต้าฟรี Google Maps ของเดือนนี้ครบแล้ว (กันค่าใช้จ่าย) — ใส่ข้อมูลเองได้' },
      { status: 429 },
    )
  }

  try {
    const place = placeId ? await getPlace(placeId) : await findPlace(query!)
    if (!place) return NextResponse.json({ error: 'ไม่พบสถานที่ใน Google Maps' }, { status: 404 })
    return NextResponse.json({ place, configured: true })
  } catch (err) {
    console.error('[admin/maps] error:', err)
    return NextResponse.json({ error: 'ดึงข้อมูลจาก Google Maps ไม่สำเร็จ' }, { status: 500 })
  }
}
