import { NextRequest, NextResponse } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/authz'

/**
 * POST /api/admin/cloudinary/delete
 * Body: { public_id: string, secure_url: string }
 *
 * Deletes an asset from Cloudinary AND nulls out any Template / Trip rows
 * that reference it. Admin-only.
 *
 * Keeping DB and Cloudinary in sync via our app is the right pattern —
 * deleting directly from the Cloudinary dashboard leaves orphaned URL
 * references in the DB, which render as broken images. The
 * `/api/admin/cleanup-covers` endpoint fixes those after the fact.
 *
 * We use POST instead of DELETE with a path param because Cloudinary
 * public_ids contain slashes (`dopamichi/covers/abc`) which are awkward
 * in Next.js dynamic route segments.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }

  const body = await req.json()
  const { public_id, secure_url } = body as { public_id?: string; secure_url?: string }

  if (!public_id) {
    return NextResponse.json({ error: 'public_id is required' }, { status: 400 })
  }

  try {
    // 1. Delete from Cloudinary
    const cloudinaryResult = await cloudinary.uploader.destroy(public_id, {
      resource_type: 'image',
      invalidate: true,
    })

    if (cloudinaryResult.result !== 'ok' && cloudinaryResult.result !== 'not found') {
      console.error('[cloudinary/delete] unexpected result:', cloudinaryResult)
      return NextResponse.json(
        { error: `Cloudinary delete failed: ${cloudinaryResult.result}` },
        { status: 500 }
      )
    }

    // 2. Null out DB references (best effort — by URL and/or by public_id match)
    const urlVariants: string[] = []
    if (secure_url) urlVariants.push(secure_url)

    let templatesCleaned = 0
    let tripsCleaned = 0

    if (urlVariants.length > 0) {
      const tmplResult = await prisma.template.updateMany({
        where: { coverImage: { in: urlVariants } },
        data: { coverImage: null },
      })
      templatesCleaned = tmplResult.count

      const tripResult = await prisma.trip.updateMany({
        where: { coverImage: { in: urlVariants } },
        data: { coverImage: null },
      })
      tripsCleaned = tripResult.count
    }

    // Also catch URLs that contain the public_id (handles variants from
    // Cloudinary's URL transformations if we ever store transformed versions)
    const fuzzyTmplResult = await prisma.template.updateMany({
      where: { coverImage: { contains: public_id } },
      data: { coverImage: null },
    })
    templatesCleaned += fuzzyTmplResult.count

    const fuzzyTripResult = await prisma.trip.updateMany({
      where: { coverImage: { contains: public_id } },
      data: { coverImage: null },
    })
    tripsCleaned += fuzzyTripResult.count

    return NextResponse.json({
      ok: true,
      cloudinary: cloudinaryResult.result,
      templatesCleaned,
      tripsCleaned,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed'
    console.error('[cloudinary/delete] failed:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
