'use client'

import { motion, AnimatePresence } from 'motion/react'
import { AlertTriangle, CalendarCheck } from 'lucide-react'

/**
 * Branded confirmation dialog — replaces the native window.confirm(). Controlled:
 * render it with `open` and supply onConfirm/onCancel. `tone` themes the confirm
 * button ('default' = brick, 'danger' = red for destructive actions).
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'ยืนยัน',
  cancelLabel = 'ยกเลิก',
  tone = 'default',
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}) {
  const Icon = tone === 'danger' ? AlertTriangle : CalendarCheck
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(35,26,14,0.7)' }}
          onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
        >
          <motion.div
            initial={{ y: 24, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            // The trip modal's card language: font-detail, rounded-3xl, white.
            className="w-full max-w-sm overflow-hidden rounded-3xl border border-zen-black/10 bg-white font-detail shadow-2xl"
          >
            <div className="p-6">
              <div
                className={`mb-4 grid size-12 place-items-center rounded-full ${
                  tone === 'danger' ? 'bg-red-50' : 'bg-basel-brick/10'
                }`}
              >
                <Icon size={22} strokeWidth={2.5} className={tone === 'danger' ? 'text-red-600' : 'text-basel-brick'} />
              </div>
              {/* Card-heading scale (was font-headline black xl); body at the
                  panels' detail size. */}
              <h3 className="text-lg font-extrabold tracking-tight text-zen-black">{title}</h3>
              <div className="mt-1.5 text-[13px] leading-relaxed text-graphite/80">{message}</div>
            </div>
            {/* Rounded-full pills, same as every other CTA pair in the app:
                outline to dismiss, filled to commit (was rounded-lg uppercase
                blocks with wide tracking). */}
            <div className="flex gap-2 px-6 pb-6">
              <button
                onClick={onCancel}
                className="flex-1 rounded-full border border-zen-black/15 bg-white py-3 text-sm font-semibold text-zen-black transition-colors hover:border-basel-brick/50 hover:text-basel-brick"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                className={`flex-1 rounded-full py-3 text-sm font-semibold text-white shadow-md transition-colors ${
                  tone === 'danger'
                    ? 'bg-red-600 shadow-red-600/25 hover:bg-red-700'
                    : 'bg-zen-black shadow-zen-black/25 hover:bg-basel-brick'
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
