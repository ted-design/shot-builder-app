import { useEffect, useState, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { onIdTokenChanged } from "firebase/auth";
import { auth } from "./lib/firebase";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { FLAGS, isDemoModeActive } from "./lib/flags";
import { useAuth } from "./context/AuthContext";
import { DemoModeAuthProvider } from "./context/DemoModeAuthProvider";
// LoginPage is statically imported (not lazy) to avoid Safari "Importing a module
// script failed" errors. /login is the redirect-return target for mobile OAuth and
// must always be available in the main bundle without a network round-trip.
import LoginPage from "./pages/LoginPage";
import DemoModeBanner from "./components/DemoModeBanner";
import { adaptUser } from "./auth/adapter";
import AuthReadyGate from "./auth/AuthReadyGate";
import SidebarLayout from "./components/layout/SidebarLayout";
import RequireRole from "./routes/RequireRole";
import ProjectParamScope from "./routes/ProjectParamScope";
import { ProjectScopeProvider, useProjectScope } from "./context/ProjectScopeContext";
import { ThemeProvider } from "./context/ThemeContext";
import { SearchCommandProvider } from "./context/SearchCommandContext";
import { LoadingSpinner } from "./components/ui/LoadingSpinner";
import SearchCommand from "./components/ui/SearchCommand";
import GlobalKeyboardShortcuts from "./components/GlobalKeyboardShortcuts";

// Configure TanStack Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - data considered fresh
      gcTime: 10 * 60 * 1000, // 10 minutes - cache garbage collection (formerly cacheTime)
      retry: 1, // Retry failed queries once
      refetchOnWindowFocus: false, // Don't refetch on window focus for better UX
    },
  },
});

// ProjectsPage is statically imported (not lazy) because it is the post-login
// landing route (/projects). After a mobile OAuth redirect completes on /login,
// the app navigates here immediately — a lazy import at that point risks a
// "Importing a module script failed" TypeError on Safari/iOS.
import ProjectsPage from "./pages/ProjectsPage";

// Lazy load all other major pages to reduce initial bundle size
const ShotsPage = lazy(() => import("./pages/ShotsPage"));
const ShotEditorPageV3 = lazy(() => import("./pages/ShotEditorPageV3"));
const ProductsPage = lazy(() => import("./pages/ProductsPage"));
const ProductDetailPageV3 = lazy(() => import("./pages/ProductDetailPageV3"));
const ImportProducts = lazy(() => import("./pages/ImportProducts"));
const TalentPage = lazy(() => import("./pages/TalentPage"));
const LocationsPage = lazy(() => import("./pages/LocationsPage"));
const LibraryPage = lazy(() => import("./pages/LibraryPage"));
// R.18: Profiles surface deprecated — /library now redirects to /library/talent
// LibraryProfilesPage kept for redirect handling only
const LibraryProfilesPage = lazy(() => import("./pages/LibraryProfilesPage"));
const LibraryTalentPage = lazy(() => import("./pages/LibraryTalentPage"));
const LibraryCrewPage = lazy(() => import("./pages/LibraryCrewPage"));
const LibraryLocationsPage = lazy(() => import("./pages/LibraryLocationsPage"));
const PalettePage = lazy(() => import("./pages/PalettePage"));
const PullsPage = lazy(() => import("./pages/PullsPage"));
const PullPublicViewPage = lazy(() => import("./pages/PullPublicViewPage"));
const PullEditorPage = lazy(() => import("./pages/PullEditorPage"));
const TagManagementPage = lazy(() => import("./pages/TagManagementPage"));
const DepartmentsPage = lazy(() => import("./pages/DepartmentsPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const ImageDiagnosticsPage = lazy(() => import("./pages/dev/ImageDiagnosticsPage"));
const BrandLockupTest = lazy(() => import("./pages/dev/BrandLockupTest"));
const PageHeaderTest = lazy(() => import("./pages/dev/PageHeaderTest"));
const DemoPage = lazy(() => import("./pages/DemoPage"));
// Dev-only quick check page for RichTextEditor bubble menu styling
const RichTextEditorDemo = lazy(() => import("./pages/dev/RichTextEditorDemo"));
const PDFExportModalLazy = lazy(() => import("./components/PDFExportModal"));
const ProjectAssetsPage = lazy(() => import("./pages/ProjectAssetsPage"));
const AccountSettingsPage = lazy(() => import("./pages/AccountSettingsPage"));
const CallSheetPage = lazy(() => import("./pages/CallSheetPage"));
const ProjectDashboardPage = lazy(() => import("./pages/ProjectDashboardPage"));
const ProjectDepartmentsPage = lazy(() => import("./pages/ProjectDepartmentsPage"));
const ProjectSettingsPage = lazy(() => import("./pages/ProjectSettingsPage"));
const CataloguePage = lazy(() => import("./pages/CataloguePage"));
const CataloguePeoplePage = lazy(() => import("./pages/CataloguePeoplePage"));
const CatalogueLocationsPage = lazy(() => import("./pages/CatalogueLocationsPage"));

function MaybeRedirectLogin({ user }) {
  const location = useLocation();
  const { pathname, state } = location;
  if (user && pathname === "/login") {
    const from = state?.from?.pathname || "/projects";
    return <Navigate to={from} replace />;
  }
  return null;
}

function AuthenticatedLayout({ guardUser, navUser, fallbackRole }) {
  const location = useLocation();
  if (!guardUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <SidebarLayout fallbackUser={navUser} fallbackRole={fallbackRole} />;
}

// Legacy redirects to new project-scoped routes
function LegacyShotsRedirect() {
  const { currentProjectId } = useProjectScope();
  if (currentProjectId) {
    return <Navigate to={`/projects/${currentProjectId}/shots`} replace />;
  }
  return <Navigate to="/projects" replace />;
}

function LegacyScheduleRedirect() {
  const { projectId } = useParams();
  const location = useLocation();
  const suffix = location?.search || "";
  return <Navigate to={`/projects/${projectId}/callsheet${suffix}`} replace />;
}

function LegacyShotEditorRedirect() {
  const { projectId, shotId } = useParams();
  const location = useLocation();
  const suffix = location?.search || "";
  if (!projectId || !shotId) return <Navigate to="/projects" replace />;
  return <Navigate to={`/projects/${projectId}/shots/${shotId}${suffix}`} replace />;
}

// Inner app component that uses auth context (must be inside DemoModeAuthProvider)
function AppRoutes() {
  const [user, setUser] = useState(null);
  const isDemo = isDemoModeActive();

  // Only subscribe to Firebase auth changes if NOT in demo mode
  useEffect(() => {
    if (isDemo) return; // Skip Firebase auth in demo mode
    return onIdTokenChanged(auth, setUser);
  }, [isDemo]);

  // Read from new AuthContext only for route guards when flag is ON
  const authCtx = useAuth();
  const authSel = FLAGS.newAuthContext
    ? authCtx
    : { user: null, ready: true, initializing: false, loadingClaims: false, role: null, projectRoles: {} };
  // Route guard truthiness remains behind flag
  const userForGuard = FLAGS.newAuthContext ? adaptUser(authSel.user) : user;
  const navUser = FLAGS.newAuthContext
    ? adaptUser(authSel.user)
    : user
      ? adaptUser(user)
      : null;
  const navRole = FLAGS.newAuthContext ? authSel.role || null : null;

  // Loading fallback component for page transitions
  const PageLoadingFallback = () => (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-sm text-slate-600">Loading...</p>
      </div>
    </div>
  );

  function PDFDemoMount() {
    const location = useLocation();
    const enabled =
      FLAGS.pdfExport === true &&
      new URLSearchParams(location.search).get("pdfDemo") === "1";
    if (!enabled) return null;
    return (
      <Suspense fallback={null}>
        <PDFExportModalLazy />
      </Suspense>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SearchCommandProvider>
          <BrowserRouter>
            {/* Demo mode banner - shows when demo mode is active */}
            <DemoModeBanner />
            <ProjectScopeProvider>
              {/* Global search command palette (Cmd+K) */}
              <SearchCommand />
              {/* Global keyboard shortcuts */}
              <GlobalKeyboardShortcuts />
              {/* Guarded + lazy-loaded PDF demo: requires flag AND ?pdfDemo=1 */}
              <PDFDemoMount />
              <MaybeRedirectLogin user={userForGuard} />
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route
                  path="/pulls/shared/:shareToken"
                  element={
                    <Suspense fallback={<PageLoadingFallback />}>
                      <PullPublicViewPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/demo/*"
                  element={
                    <Suspense fallback={<PageLoadingFallback />}>
                      <DemoPage />
                    </Suspense>
                  }
                />
                <Route path="/" element={<Navigate to="/projects" replace />} />
                {import.meta.env.DEV ? (
                  <Route
                    path="/dev/richtext"
                    element={
                      <Suspense fallback={<PageLoadingFallback />}>
                        <RichTextEditorDemo />
                      </Suspense>
                    }
                  />
                ) : null}
                <Route
                  element={
                    <AuthReadyGate fallback={null}>
                      <AuthenticatedLayout guardUser={userForGuard} navUser={navUser} fallbackRole={navRole} />
                    </AuthReadyGate>
                  }
                >
                  <Route index element={<Navigate to="/projects" replace />} />
                  <Route
                    path="/projects"
                    element={<ProjectsPage />}
                  />
                  {/* Legacy unscoped routes */}
                  <Route path="/shots" element={<LegacyShotsRedirect />} />

                  {/* Project-scoped routes */}
                  <Route path="/projects/:projectId" element={<ProjectParamScope />}>
                    <Route index element={<Navigate to="dashboard" replace />} />
                    <Route
                      path="dashboard"
                      element={
                        <Suspense fallback={<PageLoadingFallback />}>
                          <ProjectDashboardPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="departments"
                      element={
                        <Suspense fallback={<PageLoadingFallback />}>
                          <ProjectDepartmentsPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="settings"
                      element={
                        <Suspense fallback={<PageLoadingFallback />}>
                          <ProjectSettingsPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="shots"
                      element={
                        <Suspense fallback={<PageLoadingFallback />}>
                          <ShotsPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="shots/:shotId"
                      element={
                        <Suspense fallback={<PageLoadingFallback />}>
                          <ShotEditorPageV3 />
                        </Suspense>
                      }
                    />
                    {/* Back-compat alias (old links/bookmarks) */}
                    <Route path="shots/:shotId/editor" element={<LegacyShotEditorRedirect />} />
                    <Route
                      path="catalogue"
                      element={
                        <Suspense fallback={<PageLoadingFallback />}>
                          <CataloguePage />
                        </Suspense>
                      }
                    >
                      <Route index element={<Navigate to="people" replace />} />
                      <Route
                        path="people"
                        element={
                          <Suspense fallback={<PageLoadingFallback />}>
                            <CataloguePeoplePage />
                          </Suspense>
                        }
                      />
                      <Route
                        path="people/talent"
                        element={
                          <Suspense fallback={<PageLoadingFallback />}>
                            <CataloguePeoplePage />
                          </Suspense>
                        }
                      />
                      <Route
                        path="people/crew"
                        element={
                          <Suspense fallback={<PageLoadingFallback />}>
                            <CataloguePeoplePage />
                          </Suspense>
                        }
                      />
                      <Route
                        path="locations"
                        element={
                          <Suspense fallback={<PageLoadingFallback />}>
                            <CatalogueLocationsPage />
                          </Suspense>
                        }
                      />
                    </Route>
                    <Route
                      path="assets"
                      element={
                        <Suspense fallback={<PageLoadingFallback />}>
                          <ProjectAssetsPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="callsheet"
                      element={
                        <Suspense fallback={<PageLoadingFallback />}>
                          <CallSheetPage />
                        </Suspense>
                      }
                    />
                    <Route path="schedule" element={<LegacyScheduleRedirect />} />
                  </Route>
                  <Route
                    path="/products"
                    element={
                      <Suspense fallback={<PageLoadingFallback />}>
                        <ProductsPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/products/:productId"
                    element={
                      <Suspense fallback={<PageLoadingFallback />}>
                        <ProductDetailPageV3 />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/import-products"
                    element={
                      <Suspense fallback={<PageLoadingFallback />}>
                        <ImportProducts />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/library"
                    element={
                      <Suspense fallback={<PageLoadingFallback />}>
                        <LibraryPage />
                      </Suspense>
                    }
                  >
                    {/* R.18: Profiles deprecated — /library redirects to /library/talent */}
                    <Route
                      index
                      element={<Navigate to="/library/talent" replace />}
                    />
                    {/* R.18: /library/profiles redirects to /library/talent */}
                    <Route
                      path="profiles"
                      element={<Navigate to="/library/talent" replace />}
                    />
                    <Route
                      path="talent"
                      element={
                        <Suspense fallback={<PageLoadingFallback />}>
                          <LibraryTalentPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="crew"
                      element={
                        <Suspense fallback={<PageLoadingFallback />}>
                          <LibraryCrewPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="locations"
                      element={
                        <Suspense fallback={<PageLoadingFallback />}>
                          <LibraryLocationsPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="departments"
                      element={
                        <Suspense fallback={<PageLoadingFallback />}>
                          <DepartmentsPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="tags"
                      element={
                        <Suspense fallback={<PageLoadingFallback />}>
                          <TagManagementPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="palette"
                      element={
                        <Suspense fallback={<PageLoadingFallback />}>
                          <PalettePage />
                        </Suspense>
                      }
                    />
                  </Route>
                  {/* Redirect legacy org routes to Library */}
                  <Route path="/talent" element={<Navigate to="/library/talent" replace />} />
                  <Route path="/locations" element={<Navigate to="/library/locations" replace />} />
                  <Route path="/palette" element={<Navigate to="/library/palette" replace />} />
                  <Route
                    path="/pulls"
                    element={
                      <Suspense fallback={<PageLoadingFallback />}>
                        <PullsPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/pulls/:pullId/edit"
                    element={
                      <Suspense fallback={<PageLoadingFallback />}>
                        <PullEditorPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/account"
                    element={
                      <Suspense fallback={<PageLoadingFallback />}>
                        <AccountSettingsPage />
                      </Suspense>
                    }
                  />
                  <Route path="/tags" element={<Navigate to="/library/tags" replace />} />
                  {import.meta.env.DEV ? (
                    <>
                      <Route
                        path="/dev/image-diagnostics"
                        element={
                          <Suspense fallback={<PageLoadingFallback />}>
                            <ImageDiagnosticsPage />
                          </Suspense>
                        }
                      />
                      <Route
                        path="/dev/brand-lockup-test"
                        element={
                          <Suspense fallback={<PageLoadingFallback />}>
                            <BrandLockupTest />
                          </Suspense>
                        }
                      />
                      <Route
                        path="/dev/page-header-test"
                        element={
                          <Suspense fallback={<PageLoadingFallback />}>
                            <PageHeaderTest />
                          </Suspense>
                        }
                      />
                    </>
                  ) : null}
                  <Route
                    path="/admin"
                    element={
                      <Suspense fallback={<PageLoadingFallback />}>
                        <RequireRole roles={["admin"]}>
                          <AdminPage />
                        </RequireRole>
                      </Suspense>
                    }
                  />
                  <Route path="*" element={<Navigate to="/projects" replace />} />
                </Route>
              </Routes>
            </ProjectScopeProvider>
          </BrowserRouter>
        </SearchCommandProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

// Main App component - wraps everything with DemoModeAuthProvider
export default function App() {
  return (
    <DemoModeAuthProvider enabled={isDemoModeActive()}>
      <AppRoutes />
    </DemoModeAuthProvider>
  );
}
