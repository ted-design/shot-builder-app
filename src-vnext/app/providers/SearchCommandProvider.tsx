import { createContext, useContext, type ReactNode } from "react"

interface SearchCommandContextValue {
  readonly open: boolean
  readonly setOpen: (open: boolean) => void
}

const SearchCommandContext = createContext<SearchCommandContextValue>({
  open: false,
  setOpen: () => {},
})

export function SearchCommandProvider({
  children,
}: {
  readonly children: ReactNode
}) {
  // Palette UI is deferred to slice 7.
  // This provider exists so the context shape is stable for consumers.
  return (
    <SearchCommandContext.Provider value={{ open: false, setOpen: () => {} }}>
      {children}
    </SearchCommandContext.Provider>
  )
}

export function useSearchCommand(): SearchCommandContextValue {
  return useContext(SearchCommandContext)
}
