import RequireAuth from "./routes/RequireAuth";
import { useEffect, useState, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";

import NavBar from "./components/NavBarWithAuth";
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

function RequireAuth({ user, children }) {
  const location = useLocation();
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

function MaybeRedirectLogin({ user }) {
  const location = useLocation();
  const { pathname, state } = location;
  if (user && pathname === "/login") {
    const from = state?.from?.pathname || "/projects";
    return <Navigate to={from} replace />;
  }
  return null;
}

export default function App() {
  const [user, setUser] = useState(null);
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  // Read from new AuthContext only for route guards when flag is ON
  const authCtx = useAuth();
  const authSel = FLAGS.newAuthContext ? authCtx : { user: null, ready: false, initializing: false };
  // Route guard truthiness remains behind flag
  const userForGuard = FLAGS.newAuthContext ? adaptUser(authSel.user) : user;

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
      <NavBar />
      {/* Guarded + lazy-loaded PDF demo: requires flag AND ?pdfDemo=1 */}
      <PDFDemoMount />
      <MaybeRedirectLogin user={userForGuard} />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Navigate to="/projects" replace />} />
        <Route
          path="/projects"
          element={
            <AuthReadyGate fallback={null}>
              <RequireAuth user={userForGuard}>
                <ProjectsPage />
              </RequireAuth>
            </AuthReadyGate>
          }
        />
        <Route path="/shots" element={<RequireAuth user={userForGuard}><ShotsPage /></RequireAuth>} />
        <Route path="/planner" element={<RequireAuth user={userForGuard}><PlannerPage /></RequireAuth>} />
        <Route path="/products" element={<RequireAuth user={userForGuard}><ProductsPage /></RequireAuth>} />
        <Route path="/import-products" element={<RequireAuth user={userForGuard}><ImportProducts /></RequireAuth>} />
        <Route path="/talent" element={<RequireAuth user={userForGuard}><TalentPage /></RequireAuth>} />
        <Route path="/locations" element={<RequireAuth user={userForGuard}><LocationsPage /></RequireAuth>} />
        <Route path="/pulls" element={<RequireAuth user={userForGuard}><PullsPage /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/projects" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
