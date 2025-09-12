import { useEffect, useState, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";

import NavBar from "./components/NavBarWithAuth";
import { FLAGS } from "./lib/flags";
import ImportProducts from "./pages/ImportProducts";
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
      {user && <NavBar user={user} />}
      {/* Guarded + lazy-loaded PDF demo: requires flag AND ?pdfDemo=1 */}
      <PDFDemoMount />
      <MaybeRedirectLogin user={user} />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Navigate to="/projects" replace />} />
        <Route path="/projects" element={<RequireAuth user={user}><ProjectsPage /></RequireAuth>} />
        <Route path="/shots" element={<RequireAuth user={user}><ShotsPage /></RequireAuth>} />
        <Route path="/planner" element={<RequireAuth user={user}><PlannerPage /></RequireAuth>} />
        <Route path="/products" element={<RequireAuth user={user}><ProductsPage /></RequireAuth>} />
        <Route path="/import-products" element={<RequireAuth user={user}><ImportProducts /></RequireAuth>} />
        <Route path="/talent" element={<RequireAuth user={user}><TalentPage /></RequireAuth>} />
        <Route path="/locations" element={<RequireAuth user={user}><LocationsPage /></RequireAuth>} />
        <Route path="/pulls" element={<RequireAuth user={user}><PullsPage /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/projects" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
