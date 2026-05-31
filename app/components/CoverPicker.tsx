'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, Check, Trash2 } from 'lucide-react'
import CoverUpload from '@/app/components/CoverUpload'

interface CloudinaryAsset {
  public_id: string
  secure_url: string
  width: number
  height: number
  format: string
  created_at: string
  bytes: number
}

/**
 * Cover image picker — shared by the admin promote modal and the Trip Builder
 * (create + edit). Three ways to set a cover:
 *   1. Pick any previously-uploaded image from the dopamichi/covers Cloudinary
 *      folder (library browser, loaded from /api/admin/cloudinary/covers)
 *   2. Upload a new file via the branded CoverUpload (4:5 forced crop at render)
 *
 * The stored value is either a short IMG key (preset) or a full Cloudinary
 * secure_url; resolved to a final URL by lib/cover-image.ts at render time.
 */
export default function CoverPicker({
  value,
  onChange,
}: {
  value: string | null
  onChange: (value: string | null) => void
}) {
  const [libraryAssets, setLibraryAssets] = useState<CloudinaryAsset[]>([])
  const [libraryLoading, setLibraryLoading] = useState(true)
  const [libraryError, setLibraryError] = useState<string | null>(null)

  async function loadLibrary() {
    setLibraryLoading(true)
    setLibraryError(null)
    try {
      const res = await fetch('/api/admin/cloudinary/covers')
      const data = await res.json()
      if (!res.ok) {
        setLibraryError(data.error ?? `HTTP ${res.status}`)
        return
      }
      setLibraryAssets(data.assets ?? [])
    } catch (err) {
      setLibraryError(err instanceof Error ? err.message : 'Failed to load library')
    } finally {
      setLibraryLoading(false)
    }
  }

  useEffect(() => {
    loadLibrary()
  }, [])

  // After a fresh upload Cloudinary's Admin API list takes ~1–2s to reflect
  // the new asset, so we also receive the URL from CoverUpload and prepend
  // it to the library optimistically.
  function handleUploaded(url: string) {
    setLibraryAssets((prev) => {
      if (prev.some((a) => a.secure_url === url)) return prev
      return [
        {
          public_id: url.split('/').slice(-2).join('/').replace(/\.[^.]+$/, ''),
          secure_url: url,
          width: 0,
          height: 0,
          format: '',
          created_at: new Date().toISOString(),
          bytes: 0,
        },
        ...prev,
      ]
    })
    setTimeout(loadLibrary, 2000)
  }

  async function handleDeleteAsset(asset: CloudinaryAsset, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`Delete this image from Cloudinary and remove it from any template/trip using it?\n\n${asset.public_id}`)) return
    try {
      const res = await fetch('/api/admin/cloudinary/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_id: asset.public_id, secure_url: asset.secure_url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Delete failed')
      setLibraryAssets((prev) => prev.filter((a) => a.public_id !== asset.public_id))
      if (value === asset.secure_url) onChange(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  return (
    <div className="space-y-4">
      {/* Cloudinary library — browse dopamichi/covers folder */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-zen-black/60">
            From Cloudinary library{libraryAssets.length > 0 ? ` (${libraryAssets.length})` : ''}
          </p>
          <button
            type="button"
            onClick={loadLibrary}
            disabled={libraryLoading}
            className="text-[9px] font-bold uppercase tracking-widest text-zen-black/40 hover:text-basel-brick disabled:opacity-40"
          >
            {libraryLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {libraryLoading ? (
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="aspect-square bg-zen-black/5 animate-pulse" />
            ))}
          </div>
        ) : libraryError ? (
          <div className="p-3 bg-red-50 border-l-4 border-red-600 flex items-start gap-2">
            <AlertCircle size={14} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-red-700">
                Cloudinary list failed
              </p>
              <p className="text-[10px] text-red-700 font-mono break-all">{libraryError}</p>
            </div>
          </div>
        ) : libraryAssets.length === 0 ? (
          <div className="p-4 bg-briefing-cream border border-zen-black/10 space-y-2">
            <p className="text-[10px] text-zen-black/60 italic leading-relaxed">
              No assets found under <code className="font-mono bg-zen-black/5 px-1">dopamichi/covers</code>.
            </p>
            <p className="text-[10px] text-zen-black/40 leading-relaxed">
              Upload your first cover below, or verify the upload preset has{' '}
              <code className="font-mono bg-zen-black/5 px-1">Folder = dopamichi/covers</code> set
              in the Cloudinary dashboard.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2 max-h-80 overflow-y-auto pr-1">
            {libraryAssets.map((asset) => {
              const isSelected = value === asset.secure_url
              return (
                <div
                  key={asset.public_id}
                  className={`relative aspect-square overflow-hidden border-2 transition-all group ${
                    isSelected
                      ? 'border-basel-brick scale-95'
                      : 'border-transparent hover:border-zen-black/30'
                  }`}
                  title={asset.public_id}
                >
                  <button
                    type="button"
                    onClick={() => onChange(asset.secure_url)}
                    className="absolute inset-0 w-full h-full"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset.secure_url}
                      alt={asset.public_id}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-basel-brick/30 flex items-center justify-center">
                        <div className="w-6 h-6 bg-basel-brick rounded-full flex items-center justify-center">
                          <Check size={14} className="text-white" strokeWidth={3} />
                        </div>
                      </div>
                    )}
                  </button>
                  {/* Delete button — hover reveal */}
                  <button
                    type="button"
                    onClick={(e) => handleDeleteAsset(asset, e)}
                    className="absolute top-1 right-1 z-10 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-700"
                    title={`Delete ${asset.public_id} from Cloudinary`}
                    aria-label="Delete asset"
                  >
                    <Trash2 size={11} strokeWidth={2.5} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* OR separator */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-zen-black/10" />
        <span className="text-[9px] font-black uppercase tracking-widest text-zen-black/40">
          or upload from device
        </span>
        <div className="flex-1 h-px bg-zen-black/10" />
      </div>

      {/* Branded upload — direct unsigned POST, cropping happens at
          render time via c_fill,g_auto,ar_4:5 transformations. */}
      <CoverUpload value={value} onChange={onChange} label="Upload from device" onUploaded={handleUploaded} />
    </div>
  )
}
