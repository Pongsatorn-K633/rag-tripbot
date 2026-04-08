import { NextResponse } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/authz'

/**
 * POST /api/admin/cleanup-covers
 *
 * One-shot sweep that finds every Template/Trip coverImage URL pointing to
 * Cloudinary, compares against the live list of assets in the
 * dopamichi/covers folder, and nulls out any stale references.
 *
 * Use this after you've deleted assets directly in the Cloudinary dashboard
 * (which doesn't update our DB). Admin-only.
 *
 * Non-Cloudinary URLs (legacy lh3 / external) are ignored — we can't verify
 * their existence without actually HTTP HEAD-ing each one.
 */
export async function POST() {
  try {
    await requireAdmin()
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }

  try {
    // 1. Fetch every current Cloudinary asset under dopamichi/covers
    const result = await cloudinary.search
      .expression('asset_folder="dopamichi/covers" OR folder="dopamichi/covers"')
      .max_results(500)
      .execute()

    const liveUrls = new Set<string>()
    for (const r of result.resources as Array<{ secure_url: string }>) {
      liveUrls.add(r.secure_url)
    }

    // 2. Find all DB rows with Cloudinary coverImage URLs
    const templates = await prisma.template.findMany({
      where: { coverImage: { contains: 'res.cloudinary.com' } },
      select: { id: true, coverImage: true, title: true },
    })
    const trips = await prisma.trip.findMany({
      where: { coverImage: { contains: 'res.cloudinary.com' } },
      select: { id: true, coverImage: true, title: true },
    })

    // 3. Identify stale ones (URL not in the live set)
    const staleTemplates = templates.filter(
      (t) => t.coverImage && !liveUrls.has(t.coverImage)
    )
    const staleTrips = trips.filter((t) => t.coverImage && !liveUrls.has(t.coverImage))

    // 4. Null them out
    if (staleTemplates.length > 0) {
      await prisma.template.updateMany({
        where: { id: { in: staleTemplates.map((t) => t.id) } },
        data: { coverImage: null },
      })
    }
    if (staleTrips.length > 0) {
      await prisma.trip.updateMany({
        where: { id: { in: staleTrips.map((t) => t.id) } },
        data: { coverImage: null },
      })
    }

    console.log(
      `[cleanup-covers] cleaned ${staleTemplates.length} templates, ${staleTrips.length} trips`
    )

    return NextResponse.json({
      ok: true,
      liveAssets: liveUrls.size,
      templatesChecked: templates.length,
      tripsChecked: trips.length,
      templatesCleaned: staleTemplates.length,
      tripsCleaned: staleTrips.length,
      staleTemplateTitles: staleTemplates.map((t) => t.title),
      staleTripTitles: staleTrips.map((t) => t.title),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Cleanup failed'
    console.error('[cleanup-covers] failed:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
