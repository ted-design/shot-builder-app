import { lazy, Suspense } from "react"
import { Navigate, Route, Routes } from "react-router-dom"
import { NotFoundPage } from "@/shared/components/NotFoundPage"
import { RequireAuth } from "@/app/routes/guards/RequireAuth"
import { RequireRole } from "@/app/routes/guards/RequireRole"
import { RequireDesktop } from "@/app/routes/guards/RequireDesktop"
import { ProjectScopeProvider } from "@/app/providers/ProjectScopeProvider"
import { AppShell } from "@/shared/components/AppShell"
import { RouteBoundary } from "@/app/routes/RouteBoundary"

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
const ExportBuilderPage = lazy(
  () => import("@/features/export/components/ExportBuilderPage"),
)
const OnSetViewerPage = lazy(
  () => import("@/features/schedules/components/OnSetViewerPage"),
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
const ShotRequestCentrePage = lazy(
  () => import("@/features/requests/components/ShotRequestCentrePage"),
)
const CastingBoardPage = lazy(
  () => import("@/features/casting/components/CastingBoardPage"),
)
const PublicCastingReviewPage = lazy(
  () => import("@/features/casting/components/PublicCastingReviewPage"),
)
const SharedLinksPage = lazy(
  () => import("@/features/links/components/SharedLinksPage"),
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
        <Route path="/casting/shared/:shareToken" element={<PublicCastingReviewPage />} />
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/projects" replace />} />
          <Route
            path="projects"
            element={
              <RouteBoundary featureName="Projects">
                <ProjectDashboard />
              </RouteBoundary>
            }
          />
          <Route
            path="projects/:id/shots"
            element={
              <RouteBoundary featureName="Shots">
                <ProjectScopeProvider>
                  <ShotListPage />
                </ProjectScopeProvider>
              </RouteBoundary>
            }
          />
          <Route
            path="projects/:id/shots/:sid"
            element={
              <RouteBoundary featureName="Shot details">
                <ProjectScopeProvider>
                  <ShotDetailPage />
                </ProjectScopeProvider>
              </RouteBoundary>
            }
          />
          <Route
            path="projects/:id/pulls"
            element={
              <RouteBoundary featureName="Pulls">
                <ProjectScopeProvider>
                  <PullListPage />
                </ProjectScopeProvider>
              </RouteBoundary>
            }
          />
          <Route
            path="projects/:id/pulls/:pid"
            element={
              <RouteBoundary featureName="Pull details">
                <ProjectScopeProvider>
                  <PullDetailPage />
                </ProjectScopeProvider>
              </RouteBoundary>
            }
          />
          <Route
            path="projects/:id/assets"
            element={
              <RouteBoundary featureName="Assets">
                <ProjectScopeProvider>
                  <ProjectAssetsPage />
                </ProjectScopeProvider>
              </RouteBoundary>
            }
          />
          <Route
            path="projects/:id/casting"
            element={
              <RouteBoundary featureName="Casting">
                <ProjectScopeProvider>
                  <CastingBoardPage />
                </ProjectScopeProvider>
              </RouteBoundary>
            }
          />
          <Route
            path="projects/:id/tags"
            element={
              <RouteBoundary featureName="Tags">
                <ProjectScopeProvider>
                  <RequireDesktop label="Tag management">
                    <TagManagementPage />
                  </RequireDesktop>
                </ProjectScopeProvider>
              </RouteBoundary>
            }
          />
          <Route
            path="projects/:id/links"
            element={
              <RouteBoundary featureName="Shared links">
                <ProjectScopeProvider>
                  <SharedLinksPage />
                </ProjectScopeProvider>
              </RouteBoundary>
            }
          />
          <Route
            path="projects/:id/callsheet"
            element={
              <RouteBoundary featureName="Call sheet">
                <ProjectScopeProvider>
                  <RequireDesktop label="Call sheets">
                    <CallSheetBuilderPage />
                  </RequireDesktop>
                </ProjectScopeProvider>
              </RouteBoundary>
            }
          />
          <Route
            path="projects/:id/export"
            element={
              <RouteBoundary featureName="Export">
                <ProjectScopeProvider>
                  <RequireDesktop label="Export builder">
                    <ExportBuilderPage />
                  </RequireDesktop>
                </ProjectScopeProvider>
              </RouteBoundary>
            }
          />
          <Route
            path="projects/:id/schedules/:scheduleId/onset"
            element={
              <RouteBoundary featureName="On-set viewer">
                <OnSetViewerPage />
              </RouteBoundary>
            }
          />
          <Route
            path="requests"
            element={
              <RouteBoundary featureName="Requests">
                <RequireRole allowed={["admin", "producer"]}>
                  <ShotRequestCentrePage />
                </RequireRole>
              </RouteBoundary>
            }
          />
          <Route
            path="products"
            element={
              <RouteBoundary featureName="Products">
                <ProductListPage />
              </RouteBoundary>
            }
          />
          <Route
            path="products/new"
            element={
              <RouteBoundary featureName="New product">
                <ProductEditorPage />
              </RouteBoundary>
            }
          />
          <Route
            path="products/:fid/edit"
            element={
              <RouteBoundary featureName="Product editor">
                <ProductEditorPage />
              </RouteBoundary>
            }
          />
          <Route
            path="products/:fid"
            element={
              <RouteBoundary featureName="Product">
                <ProductDetailPage />
              </RouteBoundary>
            }
          />
          <Route
            path="library/talent"
            element={
              <RouteBoundary featureName="Talent library">
                <LibraryTalentPage />
              </RouteBoundary>
            }
          />
          <Route
            path="library/locations"
            element={
              <RouteBoundary featureName="Locations library">
                <LibraryLocationsPage />
              </RouteBoundary>
            }
          />
          <Route
            path="library/locations/:locationId"
            element={
              <RouteBoundary featureName="Location">
                <LocationDetailPage />
              </RouteBoundary>
            }
          />
          <Route
            path="library/crew"
            element={
              <RouteBoundary featureName="Crew library">
                <LibraryCrewPage />
              </RouteBoundary>
            }
          />
          <Route
            path="library/crew/:crewId"
            element={
              <RouteBoundary featureName="Crew member">
                <CrewDetailPage />
              </RouteBoundary>
            }
          />
          <Route
            path="library/palette"
            element={
              <RouteBoundary featureName="Palette library">
                <LibraryPalettePage />
              </RouteBoundary>
            }
          />
          <Route
            path="admin"
            element={
              <RouteBoundary featureName="Admin">
                <RequireRole allowed={["admin"]}>
                  <RequireDesktop label="Admin">
                    <AdminPage />
                  </RequireDesktop>
                </RequireRole>
              </RouteBoundary>
            }
          />
          {import.meta.env.DEV && DevImportQ2 && (
            <Route
              path="dev/import-q2"
              element={
                <RouteBoundary featureName="Dev tools">
                  <DevImportQ2 />
                </RouteBoundary>
              }
            />
          )}
          {import.meta.env.DEV && DevImportQ2Shots && (
            <Route
              path="dev/import-q2-shots"
              element={
                <RouteBoundary featureName="Dev tools">
                  <DevImportQ2Shots />
                </RouteBoundary>
              }
            />
          )}
          {import.meta.env.DEV && DevImportQ1HubShots && (
            <Route
              path="dev/import-q1-hub-shots"
              element={
                <RouteBoundary featureName="Dev tools">
                  <DevImportQ1HubShots />
                </RouteBoundary>
              }
            />
          )}
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
