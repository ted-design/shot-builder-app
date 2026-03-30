import { createContext, useContext, useState, type ReactNode } from "react"

interface SearchCommandContextValue {
  readonly open: boolean
  readonly setOpen: (open: boolean | ((prev: boolean) => boolean)) => void
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
  const [open, setOpen] = useState(false)

  return (
    <SearchCommandContext.Provider value={{ open, setOpen }}>
      {children}
    </SearchCommandContext.Provider>
  )
}

export function useSearchCommand(): SearchCommandContextValue {
  return useContext(SearchCommandContext)
}
