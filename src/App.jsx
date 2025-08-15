import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";

import NavBar from "./components/NavBar";
import LoginPage from "./pages/LoginPage";
import ShotsPage from "./pages/ShotsPage";
import PlannerPage from "./pages/PlannerPage";
import ProductsPage from "./pages/ProductsPage";
import TalentPage from "./pages/TalentPage";
import LocationsPage from "./pages/LocationsPage";
import ProjectsPage from "./pages/ProjectsPage";
import PullsPage from "./pages/PullsPage";

function Authed({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function MaybeRedirectLogin({ user }) {
  const { pathname } = useLocation();
  if (user && pathname === "/login") return <Navigate to="/projects" replace />;
  return null;
}

export default function App() {
  const [user, setUser] = useState(null);
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  return (
    <BrowserRouter>
      {user && <NavBar user={user} />}
      <MaybeRedirectLogin user={user} />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Navigate to="/projects" replace />} />
        <Route path="/projects" element={<Authed user={user}><ProjectsPage /></Authed>} />
        <Route path="/shots" element={<Authed user={user}><ShotsPage /></Authed>} />
        <Route path="/planner" element={<Authed user={user}><PlannerPage /></Authed>} />
        <Route path="/products" element={<Authed user={user}><ProductsPage /></Authed>} />
        <Route path="/talent" element={<Authed user={user}><TalentPage /></Authed>} />
        <Route path="/locations" element={<Authed user={user}><LocationsPage /></Authed>} />
        <Route path="/pulls" element={<Authed user={user}><PullsPage /></Authed>} />
        <Route path="*" element={<Navigate to="/projects" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
