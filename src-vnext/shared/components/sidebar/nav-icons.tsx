import {
  ArrowLeft,
  CalendarDays,
  Camera,
  ClipboardList,
  HardHat,
  Image,
  Landmark,
  LayoutGrid,
  MapPin,
  Package,
  Palette,
  Settings,
  ShieldCheck,
  Tag,
  Users,
  type LucideIcon,
} from "lucide-react"
import type { NavItemIcon } from "./nav-config"

const ICON_MAP: Record<NavItemIcon, LucideIcon> = {
  "layout-grid": LayoutGrid,
  camera: Camera,
  "clipboard-list": ClipboardList,
  image: Image,
  "calendar-days": CalendarDays,
  package: Package,
  landmark: Landmark,
  users: Users,
  "hard-hat": HardHat,
  "map-pin": MapPin,
  palette: Palette,
  "arrow-left": ArrowLeft,
  settings: Settings,
  "shield-check": ShieldCheck,
  tag: Tag,
}

export function NavIcon({
  name,
  className = "h-5 w-5 shrink-0",
}: {
  readonly name: NavItemIcon
  readonly className?: string
}) {
  const Icon = ICON_MAP[name]
  return <Icon className={className} />
}
