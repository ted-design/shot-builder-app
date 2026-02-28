import { lazy, Suspense } from "react"
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom"
import { NotFoundPage } from "@/shared/components/NotFoundPage"
import { RequireAuth } from "@/app/routes/guards/RequireAuth"
import { RequireRole } from "@/app/routes/guards/RequireRole"
import { RequireDesktop } from "@/app/routes/guards/RequireDesktop"
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
const PublicShotSharePage = lazy(
  () => import("@/features/shots/components/PublicShotSharePage"),
)
const TagManagementPage = lazy(
  () => import("@/features/shots/components/TagManagementPage"),
)
const ProjectAssetsPage = lazy(
  () => import("@/features/assets/components/ProjectAssetsPage"),
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
const WarehousePickGuidePage = lazy(
  () => import("@/features/pulls/components/WarehousePickGuidePage"),
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
const ProductEditorPage = lazy(
  () => import("@/features/products/components/ProductEditorPage"),
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
const CrewDetailPage = lazy(
  () => import("@/features/library/components/CrewDetailPage"),
)
const LocationDetailPage = lazy(
  () => import("@/features/library/components/LocationDetailPage"),
)
const LibraryPalettePage = lazy(
  () => import("@/features/library/components/LibraryPalettePage"),
)
const AdminPage = lazy(
  () => import("@/features/admin/components/AdminPage"),
)
const ShotRequestInboxPage = lazy(
  () => import("@/features/requests/components/ShotRequestInboxPage"),
)

// Dev-only components — only imported in development to keep them out of production bundles
const DevImportQ2 = import.meta.env.DEV
  ? lazy(() => import("@/features/products/components/DevImportQ2"))
  : null
const DevImportQ2Shots = import.meta.env.DEV
  ? lazy(() => import("@/features/shots/components/DevImportQ2Shots"))
  : null
const DevImportQ1HubShots = import.meta.env.DEV
  ? lazy(() => import("@/features/shots/components/DevImportQ1HubShots"))
  : null

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
        <Route path="/pulls/shared/:shareToken/guide" element={<WarehousePickGuidePage />} />
        <Route path="/shots/shared/:shareToken" element={<PublicShotSharePage />} />
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
            path="projects/:id/assets"
            element={
              <ProjectScopeProvider>
                <ProjectAssetsPage />
              </ProjectScopeProvider>
            }
          />
          <Route
            path="projects/:id/tags"
            element={
              <ProjectScopeProvider>
                <RequireDesktop label="Tag management">
                  <TagManagementPage />
                </RequireDesktop>
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
                <RequireDesktop label="Call sheets">
                  <CallSheetBuilderPage />
                </RequireDesktop>
              </ProjectScopeProvider>
            }
          />
          <Route
            path="inbox"
            element={
              <RequireRole allowed={["admin", "producer"]}>
                <ShotRequestInboxPage />
              </RequireRole>
            }
          />
          <Route path="products" element={<ProductListPage />} />
          <Route path="products/new" element={<ProductEditorPage />} />
          <Route path="products/:fid/edit" element={<ProductEditorPage />} />
          <Route path="products/:fid" element={<ProductDetailPage />} />
          <Route path="library" element={<Navigate to="/library/talent" replace />} />
          <Route path="library/talent" element={<LibraryTalentPage />} />
          <Route path="library/locations" element={<LibraryLocationsPage />} />
          <Route path="library/locations/:locationId" element={<LocationDetailPage />} />
          <Route path="library/crew" element={<LibraryCrewPage />} />
          <Route path="library/crew/:crewId" element={<CrewDetailPage />} />
          <Route path="library/palette" element={<LibraryPalettePage />} />
          <Route
            path="admin"
            element={
              <RequireRole allowed={["admin"]}>
                <RequireDesktop label="Admin">
                  <AdminPage />
                </RequireDesktop>
              </RequireRole>
            }
          />
          {import.meta.env.DEV && DevImportQ2 && (
            <Route path="dev/import-q2" element={<DevImportQ2 />} />
          )}
          {import.meta.env.DEV && DevImportQ2Shots && (
            <Route path="dev/import-q2-shots" element={<DevImportQ2Shots />} />
          )}
          {import.meta.env.DEV && DevImportQ1HubShots && (
            <Route path="dev/import-q1-hub-shots" element={<DevImportQ1HubShots />} />
          )}
        </Route>
        <Route path="*" element={<NotFoundPage />} />
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
