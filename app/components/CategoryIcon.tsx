import {
  Plane,
  Train,
  Landmark,
  UtensilsCrossed,
  ShoppingBag,
  Hotel,
  Sparkles,
  MapPin,
} from 'lucide-react'
import type { ActivityCategory } from '@/lib/itinerary-types'

const ICON_MAP: Record<ActivityCategory, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>> = {
  flight: Plane,
  transport: Train,
  sightseeing: Landmark,
  food: UtensilsCrossed,
  shopping: ShoppingBag,
  accommodation: Hotel,
  experience: Sparkles,
  other: MapPin,
}

/**
 * Renders the lucide icon for an activity category.
 * Returns null if category is undefined (backward compat with old data).
 */
export default function CategoryIcon({
  category,
  size = 12,
  className,
}: {
  category: ActivityCategory | undefined
  size?: number
  className?: string
}) {
  if (!category) return null
  const Icon = ICON_MAP[category]
  if (!Icon) return null
  return <Icon size={size} strokeWidth={2.5} className={className} aria-label={category} />
}
