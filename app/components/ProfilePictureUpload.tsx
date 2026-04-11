'use client'

import { useRef, useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { User, X } from 'lucide-react'
import {
  uploadToCloudinary,
  validateUploadFile,
} from '@/lib/cloudinary-upload'

/**
 * Profile picture upload with circular crop.
 *
 * Flow:
 *   1. User clicks the avatar / "Upload" button
 *   2. Native file picker opens
 *   3. On file select → crop modal appears with circular mask
 *   4. User drags to reposition + scroll/pinch to zoom
 *   5. Click "Save" → crops on a hidden canvas → uploads the result to
 *      Cloudinary under `dopamichi/profiles` folder
 *   6. Returns the Cloudinary URL via `onChange(url)`
 */
export default function ProfilePictureUpload({
  value,
  onChange,
  disabled,
}: {
  value: string | null
  onChange: (url: string | null) => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Crop state
  const [rawImage, setRawImage] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

  // Upload state
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels)
  }, [])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const validationError = validateUploadFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    const reader = new FileReader()
    reader.onload = () => {
      setRawImage(reader.result as string)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
    }
    reader.readAsDataURL(file)
  }

  function handleCancelCrop() {
    setRawImage(null)
    setCroppedAreaPixels(null)
  }

  async function handleConfirmCrop() {
    if (!rawImage || !croppedAreaPixels) return

    setUploading(true)
    setProgress(0)
    setError(null)

    try {
      // Crop on a canvas
      const blob = await cropImageToBlob(rawImage, croppedAreaPixels, 512)
      const file = new File([blob], 'profile.jpg', { type: 'image/jpeg' })

      // Upload to Cloudinary using the profile preset (dopamichi/profiles folder)
      const result = await uploadToCloudinary(
        file,
        (p) => setProgress(p.percent),
        'profiles'
      )

      onChange(result.secure_url)
      setRawImage(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'อัปโหลดล้มเหลว')
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Avatar preview — clickable to upload */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading}
        className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-zen-black/10 bg-briefing-cream hover:border-basel-brick transition-colors group disabled:opacity-60"
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Profile" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-zen-black/5">
            <User size={40} className="text-zen-black/30" strokeWidth={1.5} />
          </div>
        )}
        <div className="absolute inset-0 bg-zen-black/0 group-hover:bg-zen-black/20 transition-colors flex items-center justify-center">
          <span className="text-[8px] font-black uppercase tracking-widest text-white opacity-0 group-hover:opacity-100 transition-opacity">
            {value ? 'Change' : 'Upload'}
          </span>
        </div>
      </button>

      {/* Upload progress */}
      {uploading && (
        <div className="w-full max-w-[200px] flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-zen-black/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-basel-brick transition-all duration-150 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[9px] font-bold text-zen-black/50 tabular-nums">{progress}%</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-[10px] text-red-700 font-medium">⚠ {error}</p>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
          className="text-[10px] font-bold tracking-widest text-basel-brick hover:text-zen-black transition-colors disabled:opacity-40"
        >
          {value ? 'เปลี่ยนรูป · Change' : 'อัปโหลดรูป · Upload (Optional)'}
        </button>
        {value && (
          <>
            <span className="text-zen-black/20">·</span>
            <button
              type="button"
              onClick={() => onChange(null)}
              disabled={disabled || uploading}
              className="text-[10px] font-bold uppercase tracking-widest text-zen-black/40 hover:text-basel-brick transition-colors disabled:opacity-40"
            >
              ลบรูป · Remove
            </button>
          </>
        )}
      </div>

      <p className="text-[9px] text-zen-black/40 text-center -mt-2">
        JPG / PNG / WebP · max 5 MB
      </p>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        onChange={handleFileSelect}
        disabled={disabled || uploading}
      />

      {/* Crop modal */}
      {rawImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zen-black/80 px-4">
          <div className="w-full max-w-md bg-white overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zen-black/10">
              <h3 className="font-headline font-black text-lg text-zen-black">
                ปรับตำแหน่งรูปโปรไฟล์
              </h3>
              <button
                onClick={handleCancelCrop}
                className="text-zen-black/40 hover:text-zen-black"
              >
                <X size={20} />
              </button>
            </div>

            {/* Crop area */}
            <div className="relative w-full aspect-square bg-zen-black">
              <Cropper
                image={rawImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            {/* Zoom slider */}
            <div className="px-5 py-3 flex items-center gap-3 border-t border-zen-black/10 bg-briefing-cream">
              <span className="text-[9px] font-black uppercase tracking-widest text-zen-black/40">
                Zoom
              </span>
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

            {/* Actions */}
            <div className="flex gap-3 px-5 py-4 border-t border-zen-black/10">
              <button
                onClick={handleCancelCrop}
                className="flex-1 py-3 border-2 border-zen-black font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black hover:text-white transition-all"
              >
                ยกเลิก · Cancel
              </button>
              <button
                onClick={handleConfirmCrop}
                disabled={uploading}
                className="flex-1 py-3 bg-basel-brick text-white font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black transition-all disabled:opacity-50"
              >
                {uploading ? `${progress}%...` : 'บันทึก · Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Canvas-based image crop helper ──────────────────────────────────────────

/**
 * Crops an image to the specified area at a given output size, returning a
 * JPEG Blob. Runs entirely in the browser (canvas), no server round-trip.
 */
async function cropImageToBlob(
  imageSrc: string,
  crop: Area,
  outputSize: number
): Promise<Blob> {
  const image = await loadImage(imageSrc)
  const canvas = document.createElement('canvas')
  canvas.width = outputSize
  canvas.height = outputSize
  const ctx = canvas.getContext('2d')!

  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outputSize,
    outputSize
  )

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Canvas crop failed'))
      },
      'image/jpeg',
      0.9
    )
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}
