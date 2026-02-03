import { lazy, Suspense } from "react"
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom"
import { RequireAuth } from "@/app/routes/guards/RequireAuth"
import { ProjectScopeProvider } from "@/app/providers/ProjectScopeProvider"
import { AppShell } from "@/shared/components/AppShell"

const LoginPage = lazy(() => import("@/features/auth/components/LoginPage"))
const ProjectDashboard = lazy(
  () => import("@/features/projects/components/ProjectDashboard"),
)
const ShotListPage = lazy(
  () => import("@/features/shots/components/ShotListPage"),
)
const ShotDetailPage = lazy(
  () => import("@/features/shots/components/ShotDetailPage"),
)
const PullListPage = lazy(
  () => import("@/features/pulls/components/PullListPage"),
)
const PullDetailPage = lazy(
  () => import("@/features/pulls/components/PullDetailPage"),
)
const PublicPullViewPage = lazy(
  () => import("@/features/pulls/components/PublicPullViewPage"),
)
const CallSheetBuilderPage = lazy(
  () => import("@/features/schedules/components/CallSheetBuilderPage"),
)
const ProductListPage = lazy(
  () => import("@/features/products/components/ProductListPage"),
)
const ProductDetailPage = lazy(
  () => import("@/features/products/components/ProductDetailPage"),
)
const LibraryTalentPage = lazy(
  () => import("@/features/library/components/LibraryTalentPage"),
)
const LibraryLocationsPage = lazy(
  () => import("@/features/library/components/LibraryLocationsPage"),
)
const LibraryCrewPage = lazy(
  () => import("@/features/library/components/LibraryCrewPage"),
)

function PageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
    </div>
  )
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/pulls/shared/:shareToken" element={<PublicPullViewPage />} />
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/projects" replace />} />
          <Route path="projects" element={<ProjectDashboard />} />
          <Route
            path="projects/:id"
            element={
              <ProjectScopeProvider>
                <Navigate to="shots" replace />
              </ProjectScopeProvider>
            }
          />
          <Route
            path="projects/:id/shots"
            element={
              <ProjectScopeProvider>
                <ShotListPage />
              </ProjectScopeProvider>
            }
          />
          <Route
            path="projects/:id/shots/:sid"
            element={
              <ProjectScopeProvider>
                <ShotDetailPage />
              </ProjectScopeProvider>
            }
          />
          <Route
            path="projects/:id/pulls"
            element={
              <ProjectScopeProvider>
                <PullListPage />
              </ProjectScopeProvider>
            }
          />
          <Route
            path="projects/:id/pulls/:pid"
            element={
              <ProjectScopeProvider>
                <PullDetailPage />
              </ProjectScopeProvider>
            }
          />
          <Route
            path="projects/:id/schedules"
            element={
              <ProjectScopeProvider>
                <SchedulesRedirect />
              </ProjectScopeProvider>
            }
          />
          <Route
            path="projects/:id/callsheet"
            element={
              <ProjectScopeProvider>
                <CallSheetBuilderPage />
              </ProjectScopeProvider>
            }
          />
          <Route path="products" element={<ProductListPage />} />
          <Route path="products/:fid" element={<ProductDetailPage />} />
          <Route path="library" element={<Navigate to="/library/talent" replace />} />
          <Route path="library/talent" element={<LibraryTalentPage />} />
          <Route path="library/locations" element={<LibraryLocationsPage />} />
          <Route path="library/crew" element={<LibraryCrewPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/projects" replace />} />
      </Routes>
    </Suspense>
  )
}

function SchedulesRedirect() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const suffix = location.search ?? ""
  return <Navigate to={id ? `/projects/${id}/callsheet${suffix}` : "/projects"} replace />
}
