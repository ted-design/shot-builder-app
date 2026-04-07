import {
  ArrowLeft,
  CalendarDays,
  Camera,
  ClipboardCheck,
  ClipboardList,
  FileOutput,
  HardHat,
  Image,
  Landmark,
  LayoutGrid,
  Link2,
  MapPin,
  Package,
  Palette,
  Settings,
  ShieldCheck,
  Tag,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react"
import type { NavItemIcon } from "./nav-config"

const ICON_MAP: Record<NavItemIcon, LucideIcon> = {
  "layout-grid": LayoutGrid,
  "clipboard-check": ClipboardCheck,
  camera: Camera,
  "clipboard-list": ClipboardList,
  "file-output": FileOutput,
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
  "user-check": UserCheck,
  "link-2": Link2,
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
