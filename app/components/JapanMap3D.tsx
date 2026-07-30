import { useId, useMemo } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import { JAPAN_REGIONS, JAPAN_REGION_VIEW_BOX } from '@/lib/japan-regions';

/**
 * Props for {@link JapanMap3D}. Every prop is optional โ€” the component renders a
 * responsive 3D map of Japan split into its 8 regions out of the box.
 */
export interface JapanMap3DProps {
  /**
   * CSS width of the SVG. Accepts a number (px) or any CSS length.
   * @default '100%'
   */
  width?: number | string;
  /**
   * CSS height of the SVG. When omitted the height is derived from the width
   * and the viewBox aspect ratio (1024:1536), keeping the map responsive.
   */
  height?: number | string;
  /**
   * Extrusion offset in viewBox units. Each region's side faces are the same
   * outlines translated `(depth, depth)` down-right behind the top faces.
   * @default 14
   */
  depth?: number;
  /**
   * Fill color of the regions' top faces in the `'mono'` variant.
   * @default '#f8fafc'
   */
  topColor?: string;
  /**
   * Fill color of the deepest extrusion side face. A lightened variant is
   * derived automatically for the mid layer.
   * @default '#3a4250'
   */
  sideColor?: string;
  /**
   * Color of the soft blurred drop shadow beneath the map.
   * @default '#000000'
   */
  shadowColor?: string;
  /**
   * Optional override for the top-face fill of regions listed in
   * {@link JapanMap3DProps.highlightedRegions}. When omitted, each highlighted
   * region uses its own accent color (mono) or a lightened accent (colored).
   */
  highlightColor?: string;
  /**
   * Visual style of the top faces:
   * - `'mono'`: near-white tops; a region's accent color is only used for
   *   hover/highlight feedback.
   * - `'colored'`: top faces filled with each region's accent color from the
   *   region data (mimicking the reference map), still with 3D sides/shadow.
   * @default 'mono'
   */
  variant?: 'mono' | 'colored';
  /**
   * Enables per-region hover interaction: the hovered region's top faces lift
   * up-left and brighten with a smooth CSS transition, and the cursor becomes
   * a pointer.
   * @default false
   */
  interactive?: boolean;
  /**
   * Region ids (e.g. `'hokkaido'`, `'tohoku'`, `'kanto'`, `'chubu'`,
   * `'kinki'`, `'chugoku'`, `'shikoku'`, `'kyushu-okinawa'`) rendered with
   * their highlight fill.
   */
  highlightedRegions?: string[];
  /**
   * Called with the stable region id when a region is clicked.
   * Only wired up when provided (implies pointer cursor on regions).
   */
  onRegionClick?: (regionId: string) => void;
  /**
   * Called with the hovered region id, or `null` when the pointer leaves all
   * regions. Only wired up when provided.
   */
  onRegionHover?: (regionId: string | null) => void;
  /**
   * Draw each region's name on its top face (reference-map style). Labels
   * live inside the region's lifting group, so they rise with the hover and
   * never intercept the pointer.
   * @default false
   */
  showLabels?: boolean;
  /**
   * Region id to render in its hover state (lift + accent fill) even though
   * the pointer isn't over it — lets an external control (e.g. a legend chip)
   * mirror the map's own hover feedback.
   */
  externalHoverRegion?: string | null;
  /** Extra class names forwarded to the root `<svg>` element. */
  className?: string;
}

/** On-map display names (shorter than the data names) + per-region nudges in
 *  viewBox units, for centroids that land off the visual middle of concave or
 *  elongated shapes. */
const LABELS: Record<string, { text: string; dx?: number; dy?: number }> = {
  hokkaido: { text: 'HOKKAIDO', dx: 6, dy: -6 },
  tohoku: { text: 'TOHOKU', dx: 22 },
  kanto: { text: 'KANTO', dy: 10 },
  chubu: { text: 'CHUBU', dx: -8, dy: 14 },
  kinki: { text: 'KANSAI', dy: 8 },
  chugoku: { text: 'CHUGOKU', dx: 12, dy: -4 },
  shikoku: { text: 'SHIKOKU', dx: 8, dy: 4 },
  'kyushu-okinawa': { text: 'KYUSHU', dx: 20 },
};

/** Mix a `#rrggbb` hex color with white. `amount` 0 keeps the color, 1 gives white. */
function lighten(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const to2 = (c: number) => c.toString(16).padStart(2, '0');
  return `#${to2(mix(r))}${to2(mix(g))}${to2(mix(b))}`;
}

/**
 * Reusable, dependency-free SVG map of Japan with a fake 3D extrusion:
 * top faces, slate side faces translated down-right, and a soft blurred drop
 * shadow that grounds the map on a dark background.
 *
 * The interactive units are Japan's 8 regions (hokkaido, tohoku, kanto,
 * chubu, kinki, chugoku, shikoku, kyushu-okinawa). Each region is a group of
 * one or more path outlines treated as a single hover/click/highlight target.
 *
 * @example
 * ```tsx
 * <JapanMap3D
 *   depth={16}
 *   interactive
 *   variant="colored"
 *   highlightedRegions={['kanto']}
 *   onRegionClick={(id) => console.log(id)}
 *   onRegionHover={(id) => console.log('hover', id)}
 * />
 * ```
 */
export default function JapanMap3D({
  width = '100%',
  height,
  depth = 14,
  topColor = '#f8fafc',
  sideColor = '#3a4250',
  shadowColor = '#000000',
  highlightColor,
  variant = 'mono',
  interactive = false,
  highlightedRegions,
  onRegionClick,
  onRegionHover,
  showLabels = false,
  externalHoverRegion = null,
  className,
}: JapanMap3DProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const shadowFilterId = `jm-shadow-${uid}`;
  const sheenId = `jm-sheen-${uid}`;

  const sideMidColor = useMemo(() => lighten(sideColor, 0.42), [sideColor]);
  const highlighted = useMemo(() => new Set(highlightedRegions ?? []), [highlightedRegions]);

  // Label anchor per region: the vertex average of its FIRST path (the main
  // landmass in this data set) — close enough to the visual centre for these
  // smoothed outlines; LABELS carries per-region nudges for the stragglers.
  const labelAnchors = useMemo(() => {
    if (!showLabels) return null;
    const anchors: Record<string, [number, number]> = {};
    for (const region of JAPAN_REGIONS) {
      const nums = (region.paths[0].match(/-?[\d.]+/g) ?? []).map(Number);
      let sx = 0, sy = 0, n = 0;
      for (let i = 0; i + 1 < nums.length; i += 2) { sx += nums[i]; sy += nums[i + 1]; n++; }
      if (n > 0) anchors[region.id] = [sx / n, sy / n];
    }
    return anchors;
  }, [showLabels]);

  // Extra room around the artwork for the extrusion and the blurred shadow.
  const pad = Math.max(24, depth * 1.6 + 26);
  const [vx, vy, vw, vh] = JAPAN_REGION_VIEW_BOX;
  const viewBox = `${vx - pad} ${vy - pad} ${vw + depth + pad * 2} ${vh + depth + pad * 2}`;

  const clickable = interactive || onRegionClick !== undefined || onRegionHover !== undefined;

  const style: CSSProperties = { width, display: 'block' };
  if (height !== undefined) {
    style.height = height;
  }

  const handleClick = (regionId: string) => (event: MouseEvent<SVGGElement>) => {
    event.stopPropagation();
    onRegionClick?.(regionId);
  };

  /** Top-face fill for a region, honoring variant + highlight state. */
  const topFill = (accent: string, isHighlighted: boolean): string => {
    if (highlightColor !== undefined && isHighlighted) return highlightColor;
    if (variant === 'colored') {
      return isHighlighted ? lighten(accent, 0.22) : accent;
    }
    return isHighlighted ? accent : topColor;
  };

  return (
    <svg
      viewBox={viewBox}
      style={style}
      className={className}
      role="img"
      aria-label="3D map of Japan by region"
      preserveAspectRatio="xMidYMid meet"
    >
      <title>3D map of Japan by region</title>
      <defs>
        <filter
          id={shadowFilterId}
          x="-40%"
          y="-40%"
          width="180%"
          height="180%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur stdDeviation={Math.max(8, depth * 0.75)} />
        </filter>
        <linearGradient id={sheenId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        {clickable && (
          <style>{`
            /* pointer-events auto: regions stay clickable even when the HOST
               passes pointer-events-none on the svg (done when the map's
               empty sea zones overlap other controls via negative margins). */
            .jm-region-${uid} { cursor: pointer; pointer-events: auto; }
            .jm-region-${uid} .jm-top {
              transition: transform 240ms ease, filter 240ms ease;
            }
            .jm-region-${uid}:hover .jm-top,
            .jm-region-${uid}.jm-ext-hover .jm-top {
              transform: translate(-4px, -6px);
              filter: brightness(1.06);
            }
            .jm-region-${uid} .jm-face { transition: fill 200ms ease; }
            ${JAPAN_REGIONS.map(
              (r) =>
                `.jm-region-${uid}[data-region-id="${r.id}"]:hover .jm-face, .jm-region-${uid}[data-region-id="${r.id}"].jm-ext-hover .jm-face { fill: ${lighten(r.color, 0.25)}; }`,
            ).join('\n')}
          `}</style>
        )}
      </defs>

      {/* Soft ground shadow: every region path, offset down-right, blurred. */}
      <g
        transform={`translate(${depth + 6} ${depth + 18})`}
        fill={shadowColor}
        opacity={0.55}
        filter={`url(#${shadowFilterId})`}
        aria-hidden="true"
      >
        {JAPAN_REGIONS.map((region) =>
          region.paths.map((d, i) => <path key={`shadow-${region.id}-${i}`} d={d} />),
        )}
      </g>

      {/* Side faces of EVERY region first, as one non-interactive layer. They
          used to live inside each region's group — but a region's sides are
          translated down-right, so a later region's sides painted OVER an
          earlier neighbour's top faces (e.g. Chubu's over Kanto's west) and
          swallowed its hover — a dead zone on the land itself. As a layer
          UNDER all tops, sides can never sit between the pointer and a top. */}
      <g aria-hidden="true" pointerEvents="none">
        {JAPAN_REGIONS.map((region) => (
          <g key={`sides-${region.id}`}>
            {region.paths.map((d, i) => (
              <path
                key={`side-deep-${i}`}
                d={d}
                transform={`translate(${depth} ${depth})`}
                fill={sideColor}
              />
            ))}
            {region.paths.map((d, i) => (
              <path
                key={`side-mid-${i}`}
                d={d}
                transform={`translate(${depth * 0.5} ${depth * 0.5})`}
                fill={sideMidColor}
              />
            ))}
          </g>
        ))}
      </g>

      {/* Top faces above, carrying all interactivity (hover lift, click). */}
      {JAPAN_REGIONS.map((region) => {
        const isHighlighted = highlighted.has(region.id);
        const groupClass = clickable
          ? `jm-region-${uid}${externalHoverRegion === region.id ? ' jm-ext-hover' : ''}`
          : undefined;
        const fill = topFill(region.color, isHighlighted);
        return (
          <g
            key={region.id}
            className={groupClass}
            data-region-id={region.id}
            onClick={onRegionClick ? handleClick(region.id) : undefined}
            onMouseEnter={onRegionHover ? () => onRegionHover(region.id) : undefined}
            onMouseLeave={onRegionHover ? () => onRegionHover(null) : undefined}
          >
            <g className="jm-top">
              {region.paths.map((d, i) => (
                <path
                  key={`top-${i}`}
                  d={d}
                  // jm-face: the hover CSS above recolours ONLY these paths to
                  // the region's (lightened) accent — sheen/stroke untouched.
                  className="jm-face"
                  fill={fill}
                  stroke="#ffffff"
                  strokeOpacity={0.55}
                  strokeWidth={1.25}
                  strokeLinejoin="round"
                />
              ))}
              {region.paths.map((d, i) => (
                <path key={`sheen-${i}`} d={d} fill={`url(#${sheenId})`} aria-hidden="true" />
              ))}
            </g>
          </g>
        );
      })}

      {/* Region name labels — LAST layer, above every top face: inside the
          region groups, later-drawn neighbours overpainted parts of earlier
          labels. Top-layer labels stay whole (they sit still during the hover
          lift, which reads fine). pointer-events none keeps hover/click on
          the region paths beneath. */}
      {showLabels && labelAnchors && (
        <g pointerEvents="none" aria-hidden="true">
          {JAPAN_REGIONS.map((region) => {
            const a = labelAnchors[region.id];
            if (!a) return null;
            return (
              <text
                key={`label-${region.id}`}
                x={a[0] + (LABELS[region.id]?.dx ?? 0)}
                y={a[1] + (LABELS[region.id]?.dy ?? 0)}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#334155"
                fillOpacity={0.85}
                // Cream halo (painted UNDER the ink): letters that overhang
                // the land onto the graphite sea are graphite-on-graphite
                // without it — they looked "clipped" but were just camouflaged.
                stroke="#F7F9FC"
                strokeWidth={3}
                strokeOpacity={0.9}
                style={{
                  paintOrder: 'stroke',
                  fontSize: 17,
                  fontWeight: 600,
                  letterSpacing: '0.14em',
                  fontFamily: 'inherit',
                }}
              >
                {LABELS[region.id]?.text ?? region.name}
              </text>
            );
          })}
        </g>
      )}
    </svg>
  );
}
