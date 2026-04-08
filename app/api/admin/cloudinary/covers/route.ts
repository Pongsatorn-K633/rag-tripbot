import { NextResponse } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'
import { requireAdmin } from '@/lib/authz'

// The Cloudinary SDK auto-parses CLOUDINARY_URL from the environment on
// first call, so no explicit config() call is needed as long as the env var
// is set in the format: cloudinary://<key>:<secret>@<cloud_name>

/**
 * GET /api/admin/cloudinary/covers
 *
 * Lists every asset uploaded under the `dopamichi/covers/` folder via the
 * Cloudinary Admin API. Admin-only — the Admin API requires the secret key
 * which we never expose client-side.
 *
 * Used by the admin dashboard's CoverPicker so admins can browse every
 * previously-uploaded cover and pick one for a new template, instead of
 * being limited to 4 hardcoded presets.
 */
export async function GET() {
  try {
    await requireAdmin()
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }

  try {
    // Use the Search API which supports BOTH folder systems:
    //
    //   - `asset_folder="..."` — the new Dynamic Folders system (introduced
    //     2023). The public_id stays at the root but a separate metadata
    //     field points to the folder. This is what the preset's "Asset
    //     folder" field uses.
    //
    //   - `folder="..."` — the classic public-id-prefix system. The asset's
    //     public_id is `folder/random_id`. This is what the preset's "Folder"
    //     field uses.
    //
    // Matching both in one expression means we work regardless of which
    // folder system the admin chose in the Cloudinary dashboard.
    const result = await cloudinary.search
      .expression('asset_folder="dopamichi/covers" OR folder="dopamichi/covers"')
      .sort_by('created_at', 'desc')
      .max_results(100)
      .execute()

    const assets = (result.resources as Array<Record<string, unknown>>).map((r) => ({
      public_id: r.public_id,
      secure_url: r.secure_url,
      width: r.width,
      height: r.height,
      format: r.format,
      created_at: r.created_at,
      bytes: r.bytes,
    }))

    console.log(
      `[cloudinary/covers] search found ${assets.length} assets ` +
      `(total in response: ${result.total_count ?? 'unknown'})`
    )

    return NextResponse.json({ assets })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list assets'
    console.error('[cloudinary/covers] search failed:', err)
    return NextResponse.json(
      { assets: [], error: message },
      { status: 500 }
    )
  }
}
