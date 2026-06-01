'use client'

import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { X, Move } from 'lucide-react'
import { buildCloudinaryCropUrl } from '@/lib/cover-image'

/**
 * Non-destructive crop-and-drag modal for a Cloudinary image (covers 4:5,
 * profile pictures 1:1, etc.).
 *
 * It reads ONLY the crop geometry (react-easy-crop's natural-pixel area) and
 * bakes it into a `c_crop` Cloudinary URL — no canvas, no re-upload, no CORS.
 * `src` must be the ORIGINAL asset URL (strip transforms before passing) so the
 * coordinates map to the source pixels and re-framing is always lossless.
 */
export default function CoverCropModal({
  src,
  title = 'ปรับรูปหน้าปก · Adjust cover',
  aspect = 4 / 5,
  cropShape = 'rect',
  onClose,
  onSave,
}: {
  src: string
  title?: string
  /** Crop aspect ratio (cover = 4/5, profile = 1). */
  aspect?: number
  /** 'rect' (covers) or 'round' (profile avatars — circular mask). */
  cropShape?: 'rect' | 'round'
  onClose: () => void
  onSave: (croppedUrl: string) => void
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setArea(croppedPixels)
  }, [])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zen-black/80 px-4 py-6">
      <div className="w-full max-w-md bg-white overflow-hidden shadow-2xl rounded-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zen-black/10">
          <h3 className="font-headline font-black text-lg text-zen-black flex items-center gap-2">
            <Move size={16} className="text-basel-brick" /> {title}
          </h3>
          <button onClick={onClose} className="text-zen-black/40 hover:text-zen-black">
            <X size={20} />
          </button>
        </div>

        {/* Crop area — drag to reposition + scroll/pinch to zoom */}
        <div className="relative w-full bg-zen-black" style={{ aspectRatio: aspect }}>
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape={cropShape}
            showGrid={cropShape === 'rect'}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        {/* Zoom slider */}
        <div className="px-5 py-3 flex items-center gap-3 border-t border-zen-black/10 bg-briefing-cream">
          <span className="text-[9px] font-black uppercase tracking-widest text-zen-black/40">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-basel-brick"
          />
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-zen-black/10">
          <button
            onClick={onClose}
            className="flex-1 py-3 border-2 border-zen-black font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black hover:text-white transition-all"
          >
            ยกเลิก · Cancel
          </button>
          <button
            onClick={() => area && onSave(buildCloudinaryCropUrl(src, area))}
            disabled={!area}
            className="flex-1 py-3 bg-basel-brick text-white font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black transition-all disabled:opacity-50"
          >
            บันทึก · Save crop
          </button>
        </div>
      </div>
    </div>
  )
}
