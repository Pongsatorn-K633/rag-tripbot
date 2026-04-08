'use client'

import { useRef, useState } from 'react'
import { Image as ImageIcon, X, Check } from 'lucide-react'
import {
  uploadToCloudinary,
  validateUploadFile,
  UPLOAD_MAX_BYTES,
} from '@/lib/cloudinary-upload'
import { resolveCoverImage } from '@/lib/cover-image'

/**
 * Branded cover image upload component.
 *
 * Replaces next-cloudinary's <CldUploadWidget> with a custom UI that:
 *   - Matches the dopamichi zen-edition aesthetic
 *   - Avoids the iframe body-scroll-lock bug from the widget
 *   - Shows real upload progress via XMLHttpRequest events
 *   - Handles client-side validation (type, size) with Thai error messages
 *
 * Cropping is NOT done here — Cloudinary handles it at delivery time via
 * `c_fill,g_auto,ar_4:5` (see lib/cover-image.ts). Users upload any image;
 * Cloudinary auto-crops to 4:5 with content-aware gravity.
 */
export default function CoverUpload({
  value,
  onChange,
  disabled,
  label,
  onUploaded,
}: {
  /** Current stored value (Cloudinary URL, IMG key, or null) */
  value: string | null
  /** Called when the stored value should change (upload finished or cleared) */
  onChange: (value: string | null) => void
  /** Disable the component (e.g. during parent form submission) */
  disabled?: boolean
  /** Button label — defaults to the generic "Upload cover image" text */
  label?: string
  /** Optional callback fired after a successful upload, for refreshing libraries */
  onUploaded?: (url: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setError(null)
    const validationError = validateUploadFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    setUploading(true)
    setProgress(0)
    try {
      const result = await uploadToCloudinary(file, (p) => setProgress(p.percent))
      onChange(result.secure_url)
      onUploaded?.(result.secure_url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'อัปโหลดล้มเหลว')
    } finally {
      setUploading(false)
      setProgress(0)
      // Reset the input so selecting the same file twice still fires onChange
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  // Preview state — when value is set (either a fresh upload or existing value)
  if (value && !uploading) {
    return (
      <div className="space-y-2">
        <div className="relative flex items-center gap-3 p-3 bg-briefing-cream border border-zen-black/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolveCoverImage(value, 'preview')}
            alt="cover preview"
            className="w-20 h-20 object-cover border border-zen-black/10"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <Check size={12} className="text-basel-brick" strokeWidth={3} />
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-basel-brick">
                Cover set
              </p>
            </div>
            <p className="text-[10px] text-zen-black/50 leading-tight">
              Auto-cropped to 4:5 portrait at render time
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled}
              className="text-[9px] font-black uppercase tracking-widest text-zen-black/60 hover:text-basel-brick transition-colors disabled:opacity-40 px-2 py-1 border border-zen-black/20"
            >
              Change
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              disabled={disabled}
              className="p-1.5 text-zen-black/40 hover:text-basel-brick disabled:opacity-40 border border-zen-black/20 flex items-center justify-center"
              aria-label="Remove cover"
            >
              <X size={12} />
            </button>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          className="hidden"
          onChange={handleChange}
          disabled={disabled}
        />
      </div>
    )
  }

  // Uploading state — progress bar
  if (uploading) {
    return (
      <div className="space-y-2">
        <div className="relative w-full py-5 px-4 border-2 border-dashed border-basel-brick bg-basel-brick/5 overflow-hidden">
          {/* Progress fill */}
          <div
            className="absolute inset-y-0 left-0 bg-basel-brick/15 transition-all duration-150"
            style={{ width: `${progress}%` }}
          />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-basel-brick border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-black uppercase tracking-widest text-basel-brick">
                กำลังอัปโหลด... Uploading
              </span>
            </div>
            <span className="text-xs font-black tabular-nums text-basel-brick">
              {progress}%
            </span>
          </div>
        </div>
      </div>
    )
  }

  // Idle state — upload prompt
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="w-full py-5 border-2 border-dashed border-zen-black/20 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest text-zen-black/60 hover:border-basel-brick hover:text-basel-brick hover:bg-basel-brick/5 transition-all disabled:opacity-40"
      >
        <ImageIcon size={14} strokeWidth={2.5} />
        {label ?? 'Upload cover image'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />
      {error && (
        <p className="text-[10px] text-red-700 font-medium px-1">⚠ {error}</p>
      )}
      <p className="text-[10px] text-zen-black/40 leading-relaxed px-1">
        JPG / PNG / WebP · max {UPLOAD_MAX_BYTES / 1024 / 1024} MB · auto-cropped to 4:5
      </p>
    </div>
  )
}
