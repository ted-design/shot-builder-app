import {
  matchPath,
  useInRouterContext,
  useLocation,
  useParams,
} from "react-router-dom"
import { useOptionalProjectScope } from "@/app/providers/ProjectScopeProvider"
import {
  breadcrumbsConfig,
  type BreadcrumbEntry,
} from "@/app/routes/breadcrumbs"

// Resolves the breadcrumb trail for the current route by looking up the
// first matching pattern in breadcrumbsConfig. Pages that need a dynamic
// final crumb (e.g. a shot number or product name) pass it via
// `trailingLabel`; purely ancestry-based routes ignore the argument.
//
// No new Firestore subscriptions — projectName reads from the existing
// ProjectScopeProvider context when the page is project-scoped.
//
// Guarded against rendering outside a Router (unit tests that mount
// PageHeader without a MemoryRouter) via useInRouterContext.
export function useBreadcrumbs(
  trailingLabel?: string,
): readonly BreadcrumbEntry[] {
  const inRouter = useInRouterContext()
  const location = useLocationSafe(inRouter)
  const params = useParamsSafe(inRouter)
  const projectScope = useOptionalProjectScope()

  if (!inRouter || !location) return []

  for (const pattern of Object.keys(breadcrumbsConfig)) {
    const match = matchPath({ path: pattern, end: true }, location.pathname)
    if (!match) continue
    const resolver = breadcrumbsConfig[pattern]!
    return resolver({
      params,
      projectName: projectScope?.projectName || undefined,
      trailingLabel,
    })
  }

  return []
}

// React rules require hooks to be called in the same order every render.
// These wrappers preserve that by always calling the underlying hooks
// when a router is present, while returning safe defaults otherwise.
function useLocationSafe(inRouter: boolean): { pathname: string } | null {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return inRouter ? useLocation() : null
}

function useParamsSafe(
  inRouter: boolean,
): Readonly<Record<string, string | undefined>> {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return inRouter ? useParams() : {}
}
