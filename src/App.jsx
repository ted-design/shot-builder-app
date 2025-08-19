import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom"
import { AuthProvider, useAuthContext } from "./contexts/AuthContext"
import { useEffect } from "react"
import { setupKeyboardShortcuts } from "./lib/keyboard"

// Components
import NavBar from "./components/NavBar"
import LoadingSpinner from "./components/LoadingSpinner"

// Pages
import LoginPage from "./pages/LoginPage"
import ProjectsPage from "./pages/ProjectsPage"
import ShotsPage from "./pages/ShotsPage"
import PlannerPage from "./pages/PlannerPage"
import ProductsPage from "./pages/ProductsPage"
import TalentPage from "./pages/TalentPage"
import LocationsPage from "./pages/LocationsPage"
import PullRequestsPage from "./pages/PullRequestsPage"
import AdminPage from "./pages/AdminPage"

function RequireAuth({ children }) {
  const { user, loading } = useAuthContext()
  const location = useLocation()
  
  if (loading) {
    return <LoadingSpinner />
  }
  
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  
  return children
}

function AppRoutes() {
  const { user, loading } = useAuthContext()
  const location = useLocation()
  
  useEffect(() => {
    // Setup global keyboard shortcuts
    return setupKeyboardShortcuts()
  }, [])
  
  if (loading) {
    return <LoadingSpinner />
  }
  
  // Redirect to projects if already logged in and on login page
  if (user && location.pathname === "/login") {
    const from = location.state?.from?.pathname || "/projects"
    return <Navigate to={from} replace />
  }
  
  return (
    <>
      {user && <NavBar />}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Navigate to="/projects" replace />} />
        
        <Route path="/projects" element={
          <RequireAuth><ProjectsPage /></RequireAuth>
        } />
        
        <Route path="/shots" element={
          <RequireAuth><ShotsPage /></RequireAuth>
        } />
        
        <Route path="/planner" element={
          <RequireAuth><PlannerPage /></RequireAuth>
        } />
        
        <Route path="/products" element={
          <RequireAuth><ProductsPage /></RequireAuth>
        } />
        
        <Route path="/talent" element={
          <RequireAuth><TalentPage /></RequireAuth>
        } />
        
        <Route path="/locations" element={
          <RequireAuth><LocationsPage /></RequireAuth>
        } />
        
        <Route path="/pull-requests" element={
          <RequireAuth><PullRequestsPage /></RequireAuth>
        } />
        
        <Route path="/admin" element={
          <RequireAuth><AdminPage /></RequireAuth>
        } />
        
        <Route path="*" element={<Navigate to="/projects" replace />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-gray-50">
          <AppRoutes />
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}