/**
 * Direct unsigned upload to Cloudinary from the browser.
 *
 * Bypasses next-cloudinary's <CldUploadWidget> because:
 *   - The widget's iframe sometimes leaves body scroll locked after success
 *   - The widget UI can't be meaningfully rebranded
 *
 * This uses the standard unsigned upload endpoint with the same preset
 * (NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET) so admin/user uploads still land
 * in the same dopamichi/covers/ folder and show up in the admin library
 * browser.
 *
 * Cropping is NOT done client-side — we upload the original image and let
 * Cloudinary transform it at delivery time via `c_fill,g_auto,ar_4:5` (see
 * lib/cover-image.ts). `g_auto` uses smart content-aware cropping.
 */

export interface UploadProgress {
  loaded: number
  total: number
  percent: number
}

export interface UploadResult {
  secure_url: string
  public_id: string
  width: number
  height: number
  format: string
}

export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024
export const UPLOAD_ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

/**
 * Validate a file before upload. Returns an error message or null if valid.
 */
export function validateUploadFile(file: File): string | null {
  if (!UPLOAD_ALLOWED_TYPES.includes(file.type)) {
    return 'รองรับเฉพาะไฟล์ JPG / PNG / WebP'
  }
  if (file.size > UPLOAD_MAX_BYTES) {
    return `ไฟล์ใหญ่เกิน ${UPLOAD_MAX_BYTES / 1024 / 1024} MB`
  }
  return null
}

/**
 * Upload a file to Cloudinary and return the secure URL.
 *
 * @param file        The image file to upload
 * @param onProgress  Optional callback fired as the upload progresses
 */
/**
 * @param file        The image file to upload
 * @param onProgress  Optional callback fired as the upload progresses
 * @param folder      Optional Cloudinary folder override (e.g. 'dopamichi/profiles').
 *                    Only works if the upload preset allows the `folder` param.
 *                    If the preset doesn't allow it, this is silently ignored and
 *                    the upload lands in the preset's default folder.
 */
/**
 * @param file        The image file to upload
 * @param onProgress  Optional callback fired as the upload progresses
 * @param target      Upload target: 'covers' (default) uses the cover preset,
 *                    'profiles' uses the profile preset. Each preset has its
 *                    own Asset Folder configured in the Cloudinary dashboard.
 */
export function uploadToCloudinary(
  file: File,
  onProgress?: (progress: UploadProgress) => void,
  target: 'covers' | 'profiles' = 'covers'
): Promise<UploadResult> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const preset = target === 'profiles'
    ? (process.env.NEXT_PUBLIC_CLOUDINARY_PROFILE_PRESET ?? process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET)
    : process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

  if (!cloudName || !preset) {
    return Promise.reject(
      new Error('Cloudinary is not configured (missing NEXT_PUBLIC_CLOUDINARY_*)')
    )
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', preset)

  return new Promise<UploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress({
          loaded: e.loaded,
          total: e.total,
          percent: Math.round((e.loaded / e.total) * 100),
        })
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText)
          resolve({
            secure_url: data.secure_url,
            public_id: data.public_id,
            width: data.width,
            height: data.height,
            format: data.format,
          })
        } catch {
          reject(new Error('Invalid response from Cloudinary'))
        }
      } else {
        // Parse Cloudinary's error message so the user (and dev) sees
        // the actual reason, not just "HTTP 400".
        let detail = ''
        try {
          const errBody = JSON.parse(xhr.responseText)
          detail = errBody?.error?.message ?? ''
        } catch {
          detail = xhr.responseText?.slice(0, 200) ?? ''
        }
        console.error(
          `[cloudinary-upload] HTTP ${xhr.status}:`,
          detail,
          `\nPreset: ${preset}, Cloud: ${cloudName}`
        )
        reject(
          new Error(
            detail
              ? `อัปโหลดล้มเหลว: ${detail}`
              : `อัปโหลดล้มเหลว (HTTP ${xhr.status})`
          )
        )
      }
    }

    xhr.onerror = () => reject(new Error('เชื่อมต่อ Cloudinary ไม่สำเร็จ'))
    xhr.onabort = () => reject(new Error('Upload cancelled'))

    xhr.send(formData)
  })
}
