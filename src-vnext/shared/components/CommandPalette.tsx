import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  FolderOpen,
  Package,
  Users,
  UserCog,
  Plus,
  ClipboardCheck,
  Settings,
  Film,
  Package2,
  Clapperboard,
} from "lucide-react"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/ui/command"
import { Dialog, DialogContent, DialogTitle } from "@/ui/dialog"
import { useSearchCommand } from "@/app/providers/SearchCommandProvider"
import { useAuth } from "@/app/providers/AuthProvider"
import { useOptionalProjectScope } from "@/app/providers/ProjectScopeProvider"
import { ROLE } from "@/shared/lib/rbac"
import { useProjects } from "@/features/projects/hooks/useProjects"
import { useProductFamilies } from "@/features/products/hooks/useProducts"
import { useTalentLibrary } from "@/features/library/hooks/useTalentLibrary"
import { useCrewLibrary } from "@/features/library/hooks/useCrewLibrary"
import { useCommandPaletteLazyIndex } from "@/shared/hooks/useCommandPaletteLazyIndex"
import {
  buildFuseIndex,
  groupByType,
  hasAnyResults,
  loadRecentItems,
  mapCrewToEntry,
  mapProductToEntry,
  mapProjectToEntry,
  mapTalentToEntry,
  runFuseSearch,
  saveRecentItem,
  type EntityType,
  type SearchEntry,
} from "@/shared/lib/commandPaletteUtils"

// ---------------------------------------------------------------------------
// Icon helpers
// ---------------------------------------------------------------------------

function EntityIcon({ type }: { readonly type: EntityType }) {
  if (type === "project") return <FolderOpen className="text-muted-foreground" />
  if (type === "product") return <Package className="text-muted-foreground" />
  if (type === "talent") return <Users className="text-muted-foreground" />
  if (type === "crew") return <UserCog className="text-muted-foreground" />
  if (type === "shot") return <Film className="text-muted-foreground" />
  if (type === "pull") return <Package2 className="text-muted-foreground" />
  if (type === "scene") return <Clapperboard className="text-muted-foreground" />
  return <UserCog className="text-muted-foreground" />
}

// ---------------------------------------------------------------------------
// Inner palette — only rendered when open (avoids Firestore fan-out)
// ---------------------------------------------------------------------------

function CommandPaletteInner({
  onClose,
  lazyEntries,
}: {
  readonly onClose: () => void
  readonly lazyEntries: ReadonlyArray<SearchEntry>
}) {
  const navigate = useNavigate()
  const { role } = useAuth()
  const [query, setQuery] = useState("")

  const { data: projects } = useProjects()
  const { data: products } = useProductFamilies()
  const { data: talent } = useTalentLibrary()
  const { data: crew } = useCrewLibrary()

  const allEntries = useMemo<ReadonlyArray<SearchEntry>>(() => {
    const projectEntries = (projects ?? []).map(mapProjectToEntry)
    const productEntries = (products ?? []).map(mapProductToEntry)
    const talentEntries = (talent ?? []).map(mapTalentToEntry)
    const crewEntries = (crew ?? []).map(mapCrewToEntry)
    return [
      ...projectEntries,
      ...productEntries,
      ...talentEntries,
      ...crewEntries,
      ...lazyEntries,
    ]
  }, [projects, products, talent, crew, lazyEntries])

  const fuseIndex = useMemo(() => buildFuseIndex(allEntries), [allEntries])

  const recentItems = useMemo(() => loadRecentItems(), [])

  const grouped = useMemo(() => {
    if (!query.trim()) return null
    const results = runFuseSearch(fuseIndex, query)
    return groupByType(results)
  }, [fuseIndex, query])

  function handleSelect(entry: SearchEntry) {
    saveRecentItem(entry)
    navigate(entry.navigateTo)
    onClose()
  }

  function handleActionSelect(path: string) {
    navigate(path)
    onClose()
  }

  const showEmpty = query.trim() && grouped && !hasAnyResults(grouped)
  const isAdmin = role === ROLE.ADMIN

  return (
    <>
      <CommandInput
        placeholder="Search projects, products, talent, crew..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {showEmpty && <CommandEmpty>No results found.</CommandEmpty>}

        {/* Search results */}
        {grouped && hasAnyResults(grouped) && (
          <>
            {grouped.projects.length > 0 && (
              <CommandGroup heading="Projects">
                {grouped.projects.map((entry) => (
                  <CommandItem
                    key={entry.id}
                    value={`project-${entry.id}`}
                    onSelect={() => handleSelect(entry)}
                  >
                    <EntityIcon type="project" />
                    <span>{entry.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {grouped.products.length > 0 && (
              <CommandGroup heading="Products">
                {grouped.products.map((entry) => (
                  <CommandItem
                    key={entry.id}
                    value={`product-${entry.id}`}
                    onSelect={() => handleSelect(entry)}
                  >
                    <EntityIcon type="product" />
                    <span>{entry.name}</span>
                    {entry.subtitle && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {entry.subtitle}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {grouped.talent.length > 0 && (
              <CommandGroup heading="Talent">
                {grouped.talent.map((entry) => (
                  <CommandItem
                    key={entry.id}
                    value={`talent-${entry.id}`}
                    onSelect={() => handleSelect(entry)}
                  >
                    <EntityIcon type="talent" />
                    <span>{entry.name}</span>
                    {entry.subtitle && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {entry.subtitle}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {grouped.crew.length > 0 && (
              <CommandGroup heading="Crew">
                {grouped.crew.map((entry) => (
                  <CommandItem
                    key={entry.id}
                    value={`crew-${entry.id}`}
                    onSelect={() => handleSelect(entry)}
                  >
                    <EntityIcon type="crew" />
                    <span>{entry.name}</span>
                    {entry.subtitle && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {entry.subtitle}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {grouped.shots.length > 0 && (
              <CommandGroup heading="Shots">
                {grouped.shots.map((entry) => (
                  <CommandItem
                    key={entry.id}
                    value={`shot-${entry.id}`}
                    onSelect={() => handleSelect(entry)}
                  >
                    <EntityIcon type="shot" />
                    <span>{entry.name}</span>
                    {entry.subtitle && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {entry.subtitle}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {grouped.pulls.length > 0 && (
              <CommandGroup heading="Pulls">
                {grouped.pulls.map((entry) => (
                  <CommandItem
                    key={entry.id}
                    value={`pull-${entry.id}`}
                    onSelect={() => handleSelect(entry)}
                  >
                    <EntityIcon type="pull" />
                    <span>{entry.name}</span>
                    {entry.subtitle && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {entry.subtitle}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {grouped.scenes.length > 0 && (
              <CommandGroup heading="Scenes">
                {grouped.scenes.map((entry) => (
                  <CommandItem
                    key={entry.id}
                    value={`scene-${entry.id}`}
                    onSelect={() => handleSelect(entry)}
                  >
                    <EntityIcon type="scene" />
                    <span>{entry.name}</span>
                    {entry.subtitle && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {entry.subtitle}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}

        {/* Empty query: recent + quick actions */}
        {!query.trim() && (
          <>
            {recentItems.length > 0 && (
              <>
                <CommandGroup heading="Recent">
                  {recentItems.map((item) => (
                    <CommandItem
                      key={`recent-${item.type}-${item.id}`}
                      value={`recent-${item.type}-${item.id}`}
                      onSelect={() => handleSelect(item)}
                    >
                      <EntityIcon type={item.type} />
                      <span>{item.name}</span>
                      {item.subtitle && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {item.subtitle}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            <CommandGroup heading="Quick Actions">
              <CommandItem
                value="action-new-project"
                onSelect={() => handleActionSelect("/projects")}
              >
                <Plus className="text-muted-foreground" />
                <span>Create new project</span>
              </CommandItem>
              <CommandItem
                value="action-new-request"
                onSelect={() => handleActionSelect("/requests")}
              >
                <ClipboardCheck className="text-muted-foreground" />
                <span>Create new shot request</span>
              </CommandItem>
              <CommandItem
                value="action-products"
                onSelect={() => handleActionSelect("/products")}
              >
                <Package className="text-muted-foreground" />
                <span>Go to Products</span>
              </CommandItem>
              {isAdmin && (
                <CommandItem
                  value="action-admin"
                  onSelect={() => handleActionSelect("/admin")}
                >
                  <Settings className="text-muted-foreground" />
                  <span>Go to Admin</span>
                </CommandItem>
              )}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </>
  )
}

// ---------------------------------------------------------------------------
// Public component — mounts once in AppShell
// ---------------------------------------------------------------------------

export function CommandPalette() {
  const { open, setOpen } = useSearchCommand()
  const { clientId } = useAuth()
  const projectScope = useOptionalProjectScope()
  const projectId = projectScope?.projectId ?? null

  const lazyEntries = useCommandPaletteLazyIndex({ open, projectId, clientId })

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((prev: boolean) => !prev)
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [setOpen])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <Command
          shouldFilter={false}
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
        >
          {open && (
            <CommandPaletteInner
              onClose={() => setOpen(false)}
              lazyEntries={lazyEntries}
            />
          )}
        </Command>
      </DialogContent>
    </Dialog>
  )
}
