'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, Check, Trash2, Star, X, Crop } from 'lucide-react'
import CoverUpload from '@/app/components/CoverUpload'
import CoverCropModal from '@/app/components/CoverCropModal'
import { isCloudinaryUrl, stripCloudinaryTransform } from '@/lib/cover-image'

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
 * (create + edit). Pick from the dopamichi/covers Cloudinary library or upload.
 *
 * Array API: `value` is an ordered list of stored cover values (IMG key or
 * Cloudinary URL). `max` controls how many can be chosen:
 *   - max = 1 (default) → single cover (replace on pick)
 *   - max > 1           → gallery (toggle add/remove up to `max`); value[0] is
 *                         the primary cover and the rest are swiped in the preview.
 */
export default function CoverPicker({
  value,
  onChange,
  max = 1,
}: {
  value: string[]
  onChange: (value: string[]) => void
  max?: number
}) {
  const [libraryAssets, setLibraryAssets] = useState<CloudinaryAsset[]>([])
  const [libraryLoading, setLibraryLoading] = useState(true)
  const [libraryError, setLibraryError] = useState<string | null>(null)
  // Which selected cover is being re-framed (index + original URL to crop).
  const [adjusting, setAdjusting] = useState<{ index: number; src: string } | null>(null)

  const multi = max > 1
  const isFull = value.length >= max

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

  // Pick/unpick a cover. Single mode replaces; multi toggles up to `max`.
  function toggle(url: string) {
    if (value.includes(url)) {
      onChange(value.filter((u) => u !== url))
    } else if (max === 1) {
      onChange([url])
    } else if (!isFull) {
      onChange([...value, url])
    }
  }
  function removeAt(i: number) {
    onChange(value.filter((_, k) => k !== i))
  }
  function makePrimary(i: number) {
    if (i === 0) return
    const u = value[i]
    onChange([u, ...value.filter((_, k) => k !== i)])
  }

  // After a fresh upload Cloudinary's Admin API list takes ~1–2s to reflect the
  // new asset, so we prepend it to the library optimistically and auto-select it.
  function handleUploaded(url: string) {
    setLibraryAssets((prev) =>
      prev.some((a) => a.secure_url === url)
        ? prev
        : [
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
    )
    if (max === 1) onChange([url])
    else if (!value.includes(url) && value.length < max) onChange([...value, url])
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
      if (value.includes(asset.secure_url)) onChange(value.filter((u) => u !== asset.secure_url))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  return (
    <div className="space-y-4">
      {/* Selected gallery strip — ordered; the first item is the primary cover. */}
      {value.length > 0 && (
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-zen-black/60 mb-2">
            {multi ? `Selected · ${value.length}/${max}` : 'Selected'}
          </p>
          <div className="flex flex-wrap gap-2">
            {value.map((url, i) => (
              <div key={url} className="relative w-20 h-24 rounded-lg overflow-hidden border-2 border-basel-brick group/sel">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`cover ${i + 1}`} className="w-full h-full object-cover" />
                {/* Adjust crop — non-destructive, re-frames from the original */}
                {isCloudinaryUrl(url) && (
                  <button
                    type="button"
                    onClick={() => setAdjusting({ index: i, src: stripCloudinaryTransform(url) })}
                    title="ปรับครอป · Adjust crop"
                    className="absolute top-1 left-1 w-5 h-5 rounded-full bg-zen-black/70 text-white flex items-center justify-center hover:bg-basel-brick transition-colors"
                  >
                    <Crop size={11} strokeWidth={2.5} />
                  </button>
                )}
                {i === 0 ? (
                  <span className="absolute bottom-0 inset-x-0 bg-basel-brick text-white text-[8px] font-black uppercase tracking-widest text-center py-0.5">ปก · Primary</span>
                ) : (
                  multi && (
                    <button
                      type="button"
                      onClick={() => makePrimary(i)}
                      title="ตั้งเป็นรูปปก · Make primary"
                      className="absolute bottom-1 left-1 w-5 h-5 rounded-full bg-white/90 text-zen-black/70 flex items-center justify-center opacity-0 group-hover/sel:opacity-100 transition-opacity hover:text-basel-brick"
                    >
                      <Star size={11} strokeWidth={2.5} />
                    </button>
                  )
                )}
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  title="เอาออก · Remove"
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-zen-black/70 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                >
                  <X size={11} strokeWidth={3} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cloudinary library — browse dopamichi/covers folder */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-zen-black/60">
            From Cloudinary library{libraryAssets.length > 0 ? ` (${libraryAssets.length})` : ''}
            {multi && isFull && <span className="text-basel-brick ml-2 normal-case tracking-normal">· ครบ {max} รูปแล้ว</span>}
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
              const order = value.indexOf(asset.secure_url)
              const isSelected = order >= 0
              const disabled = !isSelected && multi && isFull
              return (
                <div
                  key={asset.public_id}
                  className={`relative aspect-square overflow-hidden border-2 transition-all group ${
                    isSelected
                      ? 'border-basel-brick scale-95'
                      : disabled
                        ? 'border-transparent opacity-40'
                        : 'border-transparent hover:border-zen-black/30'
                  }`}
                  title={asset.public_id}
                >
                  <button
                    type="button"
                    onClick={() => toggle(asset.secure_url)}
                    disabled={disabled}
                    className="absolute inset-0 w-full h-full disabled:cursor-not-allowed"
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
                          {multi ? (
                            <span className="text-white text-[11px] font-black">{order + 1}</span>
                          ) : (
                            <Check size={14} className="text-white" strokeWidth={3} />
                          )}
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

      {/* Branded upload — direct unsigned POST; the uploaded asset is auto-selected.
          We keep CoverUpload value-less so it stays a plain uploader (selection is
          shown in the strip above), and append/select via onUploaded. */}
      {multi && isFull ? (
        <p className="text-[11px] text-zen-black/40 text-center py-2">
          ครบ {max} รูปแล้ว — เอารูปออกก่อนถ้าต้องการเพิ่มรูปใหม่
        </p>
      ) : (
        <CoverUpload value={null} onChange={() => {}} label="Upload from device" onUploaded={handleUploaded} />
      )}

      {adjusting && (
        <CoverCropModal
          src={adjusting.src}
          onClose={() => setAdjusting(null)}
          onSave={(croppedUrl) => {
            onChange(value.map((u, k) => (k === adjusting.index ? croppedUrl : u)))
            setAdjusting(null)
          }}
        />
      )}
    </div>
  )
}
