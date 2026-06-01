'use client'

import { useRef, useState } from 'react'
import { User, Crop } from 'lucide-react'
import { uploadToCloudinary, validateUploadFile } from '@/lib/cloudinary-upload'
import { isCloudinaryUrl, stripCloudinaryTransform } from '@/lib/cover-image'
import CoverCropModal from '@/app/components/CoverCropModal'

/**
 * Profile picture upload with a non-destructive 1:1 circular crop.
 *
 * Flow:
 *   1. Pick a file → the ORIGINAL is uploaded to Cloudinary (dopamichi/profiles)
 *   2. The crop modal opens on that upload (drag to reposition + zoom)
 *   3. Save → stores a `c_crop` (1:1) Cloudinary URL — NO re-upload, the original
 *      stays intact, and you can "Adjust" any time to re-frame losslessly.
 *
 * The square crop is shown inside a round mask via CSS (rounded-full).
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
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  // The original URL currently open in the crop modal (null = closed).
  const [cropSrc, setCropSrc] = useState<string | null>(null)

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const validationError = validateUploadFile(file)
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    setUploading(true)
    setProgress(0)
    try {
      // Upload the ORIGINAL (uncropped) — cropping is a URL transform afterwards.
      const result = await uploadToCloudinary(file, (p) => setProgress(p.percent), 'profiles')
      onChange(result.secure_url) // set immediately so cancelling the crop keeps the photo
      setCropSrc(result.secure_url) // open the crop modal to frame it
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
      {error && <p className="text-[10px] text-red-700 font-medium">⚠ {error}</p>}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
          className="text-[10px] font-bold tracking-widest text-basel-brick hover:text-zen-black transition-colors disabled:opacity-40"
        >
          {value ? 'เปลี่ยนรูป · Change' : 'อัปโหลดรูป · Upload (Optional)'}
        </button>
        {value && isCloudinaryUrl(value) && (
          <>
            <span className="text-zen-black/20">·</span>
            <button
              type="button"
              onClick={() => setCropSrc(stripCloudinaryTransform(value))}
              disabled={disabled || uploading}
              className="text-[10px] font-bold tracking-widest text-basel-brick hover:text-zen-black transition-colors disabled:opacity-40 flex items-center gap-1"
            >
              <Crop size={11} strokeWidth={2.5} /> ปรับ · Adjust
            </button>
          </>
        )}
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

      <p className="text-[9px] text-zen-black/40 text-center -mt-2">JPG / PNG / WebP · max 5 MB</p>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        onChange={handleFileSelect}
        disabled={disabled || uploading}
      />

      {/* Non-destructive crop (1:1, round) — stores a c_crop URL, no re-upload */}
      {cropSrc && (
        <CoverCropModal
          src={cropSrc}
          title="ปรับรูปโปรไฟล์ · Adjust photo"
          aspect={1}
          cropShape="round"
          onClose={() => setCropSrc(null)}
          onSave={(cropped) => { onChange(cropped); setCropSrc(null) }}
        />
      )}
    </div>
  )
}
