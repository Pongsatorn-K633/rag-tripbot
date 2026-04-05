'use client'

import { useState } from 'react'

interface ActivationBannerProps {
  shareCode: string
}

export default function ActivationBanner({ shareCode }: ActivationBannerProps) {
  const [copied, setCopied] = useState(false)
  const command = `/activate ${shareCode}`

  async function handleCopy() {
    await navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="rounded-xl px-5 py-4 mt-3 mb-2"
      style={{
        backgroundColor: '#f0fdf4',
        border: '1px solid #86efac',
      }}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl flex-shrink-0">&#10003;</span>
        <div className="flex-1">
          <p className="font-semibold text-sm" style={{ color: '#166534' }}>
            แผนการเดินทางของคุณพร้อมแล้ว!
          </p>
          <p className="text-sm mt-1" style={{ color: '#166534' }}>
            รหัสเปิดใช้งาน LINE Bot:{' '}
            <span
              className="font-bold font-mono px-2 py-0.5 rounded"
              style={{ backgroundColor: '#dcfce7', color: '#15803d' }}
            >
              {shareCode}
            </span>
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code
              className="flex-1 text-sm font-mono px-3 py-2 rounded-lg select-all"
              style={{ backgroundColor: '#dcfce7', color: '#15803d' }}
            >
              {command}
            </code>
            <button
              onClick={handleCopy}
              className="px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex-shrink-0"
              style={{
                backgroundColor: copied ? '#166534' : '#15803d',
                color: '#ffffff',
              }}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="text-xs mt-2" style={{ color: '#4ade80' }}>
            คัดลอกคำสั่งด้านบนแล้วไปวางใน LINE เพื่อเริ่มใช้งาน
          </p>
        </div>
      </div>
    </div>
  )
}
