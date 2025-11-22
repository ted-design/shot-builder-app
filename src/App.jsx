import { useEffect, useState, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { onIdTokenChanged } from "firebase/auth";
import { auth } from "./lib/firebase";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { FLAGS } from "./lib/flags";
import { useAuth } from "./context/AuthContext";
import { adaptUser } from "./auth/adapter";
import AuthReadyGate from "./auth/AuthReadyGate";
import TopNavigationLayout from "./routes/TopNavigationLayout";
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

// Lazy load all major pages to reduce initial bundle size
const LoginPage = lazy(() => import("./pages/LoginPage"));
const ProjectsPage = lazy(() => import("./pages/ProjectsPage"));
const ShotsPage = lazy(() => import("./pages/ShotsPage"));
const ProductsPage = lazy(() => import("./pages/ProductsPage"));
const ImportProducts = lazy(() => import("./pages/ImportProducts"));
const TalentPage = lazy(() => import("./pages/TalentPage"));
const LocationsPage = lazy(() => import("./pages/LocationsPage"));
const LibraryPage = lazy(() => import("./pages/LibraryPage"));
const LibraryTalentPage = lazy(() => import("./pages/LibraryTalentPage"));
const LibraryLocationsPage = lazy(() => import("./pages/LibraryLocationsPage"));
const PullsPage = lazy(() => import("./pages/PullsPage"));
const PullPublicViewPage = lazy(() => import("./pages/PullPublicViewPage"));
const PullEditorPage = lazy(() => import("./pages/PullEditorPage"));
const TagManagementPage = lazy(() => import("./pages/TagManagementPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const ImageDiagnosticsPage = lazy(() => import("./pages/dev/ImageDiagnosticsPage"));
const BrandLockupTest = lazy(() => import("./pages/dev/BrandLockupTest"));
const PageHeaderTest = lazy(() => import("./pages/dev/PageHeaderTest"));
// Dev-only quick check page for RichTextEditor bubble menu styling
const RichTextEditorDemo = lazy(() => import("./pages/dev/RichTextEditorDemo"));
const PDFExportModalLazy = lazy(() => import("./components/PDFExportModal"));
const ProjectAssetsPage = lazy(() => import("./pages/ProjectAssetsPage"));
const AccountSettingsPage = lazy(() => import("./pages/AccountSettingsPage"));

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
  return <TopNavigationLayout fallbackUser={navUser} fallbackRole={fallbackRole} />;
}

// Legacy redirects to new project-scoped routes
function LegacyShotsRedirect() {
  const { currentProjectId } = useProjectScope();
  if (currentProjectId) {
    return <Navigate to={`/projects/${currentProjectId}/shots`} replace />;
  }
  return <Navigate to="/projects" replace />;
}

function LegacyPlannerRedirect() {
  const { currentProjectId } = useProjectScope();
  if (currentProjectId) {
    return <Navigate to={`/projects/${currentProjectId}/shots?view=planner`} replace />;
  }
  return <Navigate to="/projects" replace />;
}

export default function App() {
  const [user, setUser] = useState(null);
  useEffect(() => onIdTokenChanged(auth, setUser), []);

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
            <ProjectScopeProvider>
              {/* Global search command palette (Cmd+K) */}
              <SearchCommand />
              {/* Global keyboard shortcuts */}
              <GlobalKeyboardShortcuts />
              {/* Guarded + lazy-loaded PDF demo: requires flag AND ?pdfDemo=1 */}
              <PDFDemoMount />
              <MaybeRedirectLogin user={userForGuard} />
              <Routes>
                <Route
                  path="/login"
                  element={
                    <Suspense fallback={<PageLoadingFallback />}>
                      <LoginPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/pulls/shared/:shareToken"
                  element={
                    <Suspense fallback={<PageLoadingFallback />}>
                      <PullPublicViewPage />
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
                    element={
                      <Suspense fallback={<PageLoadingFallback />}>
                        <ProjectsPage />
                      </Suspense>
                    }
                  />
                  {/* Legacy unscoped routes */}
                  <Route path="/shots" element={<LegacyShotsRedirect />} />
                  <Route path="/planner" element={<LegacyPlannerRedirect />} />

                  {/* Project-scoped routes */}
                  <Route path="/projects/:projectId" element={<ProjectParamScope />}>
                    <Route
                      path="shots"
                      element={
                        <Suspense fallback={<PageLoadingFallback />}>
                          <ShotsPage />
                        </Suspense>
                      }
                    />
                    <Route path="planner" element={<Navigate to="../shots?view=planner" replace />} />
                    <Route
                      path="assets"
                      element={
                        <Suspense fallback={<PageLoadingFallback />}>
                          <ProjectAssetsPage />
                        </Suspense>
                      }
                    />
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
                    <Route index element={<Navigate to="/library/talent" replace />} />
                    <Route
                      path="talent"
                      element={
                        <Suspense fallback={<PageLoadingFallback />}>
                          <LibraryTalentPage />
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
                      path="tags"
                      element={
                        <Suspense fallback={<PageLoadingFallback />}>
                          <TagManagementPage />
                        </Suspense>
                      }
                    />
                  </Route>
                  {/* Redirect legacy org routes to Library */}
                  <Route path="/talent" element={<Navigate to="/library/talent" replace />} />
                  <Route path="/locations" element={<Navigate to="/library/locations" replace />} />
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
