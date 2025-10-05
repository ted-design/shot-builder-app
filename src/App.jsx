import { useEffect, useState, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { onIdTokenChanged } from "firebase/auth";
import { auth } from "./lib/firebase";

import { FLAGS } from "./lib/flags";
import { useAuth } from "./context/AuthContext";
import { adaptUser } from "./auth/adapter";
import ImportProducts from "./pages/ImportProducts";
import AuthReadyGate from "./auth/AuthReadyGate";
import LoginPage from "./pages/LoginPage";
import ShotsPage from "./pages/ShotsPage";
import PlannerPage from "./pages/PlannerPage";
import ProductsPage from "./pages/ProductsPage";
import TalentPage from "./pages/TalentPage";
import LocationsPage from "./pages/LocationsPage";
import ProjectsPage from "./pages/ProjectsPage";
import PullsPage from "./pages/PullsPage";
import PullPublicViewPage from "./pages/PullPublicViewPage";
import AdminPage from "./pages/AdminPage";
import SidebarLayout from "./routes/SidebarLayout";
import RequireRole from "./routes/RequireRole";
import { ProjectScopeProvider } from "./context/ProjectScopeContext";
import ImageDiagnosticsPage from "./pages/dev/ImageDiagnosticsPage";

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

  const PDFExportModalLazy = lazy(() => import("./components/PDFExportModal"));

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
    <BrowserRouter>
      <ProjectScopeProvider>
        {/* Guarded + lazy-loaded PDF demo: requires flag AND ?pdfDemo=1 */}
        <PDFDemoMount />
        <MaybeRedirectLogin user={userForGuard} />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/pulls/shared/:shareToken" element={<PullPublicViewPage />} />
          <Route path="/" element={<Navigate to="/projects" replace />} />
          <Route
            element={
              <AuthReadyGate fallback={null}>
                <AuthenticatedLayout guardUser={userForGuard} navUser={navUser} fallbackRole={navRole} />
              </AuthReadyGate>
            }
          >
            <Route index element={<Navigate to="/projects" replace />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/shots" element={<ShotsPage />} />
            <Route path="/planner" element={<PlannerPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/import-products" element={<ImportProducts />} />
            <Route path="/talent" element={<TalentPage />} />
            <Route path="/locations" element={<LocationsPage />} />
            <Route path="/pulls" element={<PullsPage />} />
            {import.meta.env.DEV ? (
              <Route path="/dev/image-diagnostics" element={<ImageDiagnosticsPage />} />
            ) : null}
            <Route
              path="/admin"
              element={
                <RequireRole roles={["admin"]}>
                  <AdminPage />
                </RequireRole>
              }
            />
            <Route path="*" element={<Navigate to="/projects" replace />} />
          </Route>
        </Routes>
      </ProjectScopeProvider>
    </BrowserRouter>
  );
}
