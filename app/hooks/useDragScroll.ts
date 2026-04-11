import { useRef, useCallback } from 'react'

/**
 * Hook that adds mouse-drag horizontal scrolling to a container.
 * Works alongside CSS `overflow-x: auto` + `scroll-snap-type: x mandatory`.
 *
 * On desktop: click-and-drag to scroll (like swiping on mobile).
 * On mobile: native touch scrolling handles it automatically.
 *
 * Usage:
 *   const { ref, handlers } = useDragScroll()
 *   <div ref={ref} {...handlers} className="overflow-x-auto snap-x ...">
 */
export function useDragScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null)
  const state = useRef({ isDown: false, startX: 0, scrollLeft: 0 })

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    state.current.isDown = true
    state.current.startX = e.pageX - el.offsetLeft
    state.current.scrollLeft = el.scrollLeft
    el.style.cursor = 'grabbing'
    el.style.userSelect = 'none'
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!state.current.isDown) return
    const el = ref.current
    if (!el) return
    e.preventDefault()
    // Disable snap during drag so movement feels smooth, not jerky
    el.style.scrollSnapType = 'none'
    const x = e.pageX - el.offsetLeft
    const walk = (x - state.current.startX) * 1.5
    el.scrollLeft = state.current.scrollLeft - walk
  }, [])

  const finishDrag = useCallback(() => {
    state.current.isDown = false
    const el = ref.current
    if (!el) return
    el.style.cursor = 'grab'
    el.style.userSelect = ''
    // Re-enable snap so the carousel smoothly settles onto the nearest card
    el.style.scrollSnapType = ''
    // Smooth-scroll to the nearest snap point
    const cardWidth = el.firstElementChild?.clientWidth ?? 1
    const idx = Math.round(el.scrollLeft / cardWidth)
    el.scrollTo({ left: cardWidth * idx, behavior: 'smooth' })
  }, [])

  const onMouseUp = useCallback(() => finishDrag(), [finishDrag])
  const onMouseLeave = useCallback(() => finishDrag(), [finishDrag])

  return {
    ref,
    handlers: {
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onMouseLeave,
    },
  }
}
