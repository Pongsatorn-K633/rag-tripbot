/**
 * Seigaiha wallpaper — the classic wave-scale pattern behind the dark pages
 * (/discover, /my-trips, /create), per the jap-discoverbg reference.
 *
 * True seigaiha geometry baked into ONE 200×100 tile: fans of radius 100 with
 * evenly-spaced rings (down to a small centre dot), rows every 50 offset by
 * half a fan and drawn top-row-first so each row's graphite fill occludes the
 * row above — the cascading fish-scale look a simple offset-layer trick can't
 * make. Cream strokes at whisper opacity; pure data-URI, zero requests.
 *
 * Rendered at HALF the tile's native size, so the scales stay small and quiet.
 * Fixed + `-z-10`: it sits above ClientLayout's graphite canvas (same layer,
 * later in the DOM) and below all page content.
 */
const SEIGAIHA_FAN =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='100'%3E%3Cdefs%3E%3Cg id='s' stroke='%23F7F9FC' stroke-opacity='.05' stroke-width='1.3'%3E%3Ccircle r='100' fill='%23334155'/%3E%3Cg fill='none'%3E%3Ccircle r='85'/%3E%3Ccircle r='70'/%3E%3Ccircle r='55'/%3E%3Ccircle r='40'/%3E%3Ccircle r='25'/%3E%3Ccircle r='10'/%3E%3C/g%3E%3C/g%3E%3C/defs%3E%3Cuse href='%23s' x='0' y='0'/%3E%3Cuse href='%23s' x='200' y='0'/%3E%3Cuse href='%23s' x='100' y='50'/%3E%3Cuse href='%23s' x='0' y='100'/%3E%3Cuse href='%23s' x='200' y='100'/%3E%3Cuse href='%23s' x='100' y='150'/%3E%3C/svg%3E"

export default function SeigaihaBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
      style={{
        backgroundImage: `url("${SEIGAIHA_FAN}")`,
        backgroundSize: '100px 50px',
      }}
    />
  )
}
