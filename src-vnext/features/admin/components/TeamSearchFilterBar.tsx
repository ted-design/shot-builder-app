import { useState, useEffect } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { Button } from "@/ui/button"
import { ROLE, roleLabel } from "@/shared/lib/rbac"
import type { Role } from "@/shared/types"

export type UserStatusFilter = "all" | "active" | "pending" | "deactivated"

const ROLE_OPTIONS: readonly Role[] = [
  ROLE.ADMIN,
  ROLE.PRODUCER,
  ROLE.CREW,
  ROLE.WAREHOUSE,
  ROLE.VIEWER,
]

interface TeamSearchFilterBarProps {
  readonly searchQuery: string
  readonly onSearchChange: (query: string) => void
  readonly roleFilter: string
  readonly onRoleFilterChange: (role: string) => void
  readonly statusFilter: UserStatusFilter
  readonly onStatusFilterChange: (status: UserStatusFilter) => void
}

export function TeamSearchFilterBar({
  searchQuery,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  statusFilter,
  onStatusFilterChange,
}: TeamSearchFilterBarProps) {
  const [localQuery, setLocalQuery] = useState(searchQuery)

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(localQuery)
    }, 250)
    return () => clearTimeout(timer)
  }, [localQuery, onSearchChange])

  useEffect(() => {
    setLocalQuery(searchQuery)
  }, [searchQuery])

  const hasFilters = searchQuery.length > 0 || roleFilter !== "all" || statusFilter !== "all"

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-subtle)]" />
        <Input
          value={localQuery}
          onChange={(e) => setLocalQuery(e.target.value)}
          placeholder="Search by name or email..."
          className="pl-9"
        />
      </div>

      <div className="flex items-center gap-2">
        <Select value={roleFilter} onValueChange={onRoleFilterChange}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {ROLE_OPTIONS.map((role) => (
              <SelectItem key={role} value={role}>
                {roleLabel(role)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => onStatusFilterChange(v as UserStatusFilter)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="deactivated">Deactivated</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              setLocalQuery("")
              onSearchChange("")
              onRoleFilterChange("all")
              onStatusFilterChange("all")
            }}
            title="Clear filters"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
