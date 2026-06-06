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
            className="w-full max-w-sm bg-briefing-cream border border-zen-black/10 shadow-2xl rounded-2xl overflow-hidden"
          >
            <div className="p-6">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
                tone === 'danger' ? 'bg-red-100' : 'bg-amber-100'
              }`}>
                <Icon size={22} strokeWidth={2.5} className={tone === 'danger' ? 'text-red-600' : 'text-amber-600'} />
              </div>
              <h3 className="font-headline font-black text-xl text-zen-black mb-2">{title}</h3>
              <div className="text-sm text-zen-black/70 leading-relaxed">{message}</div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={onCancel}
                className="flex-1 py-3 rounded-lg border-2 border-zen-black font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black hover:text-briefing-cream transition-all"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                className={`flex-1 py-3 rounded-lg text-white font-headline font-black text-xs uppercase tracking-[0.2em] transition-all ${
                  tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-basel-brick hover:bg-zen-black'
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
