// src/components/NavBar.jsx
import { Link, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

export default function NavBar({ user }) {
  const { pathname } = useLocation();
  // Determine classes for active vs inactive links
  const linkClasses = (path) =>
    pathname.startsWith(path)
      ? "text-primary font-semibold"
      : "text-gray-600 hover:text-primary";

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4">
      <Link to="/shots" className={linkClasses("/shots")}>Shots</Link>
      <Link to="/planner" className={linkClasses("/planner")}>Planner</Link>
      <Link to="/projects" className={linkClasses("/projects")}>Projects</Link>
      <Link to="/products" className={linkClasses("/products")}>Products</Link>
      <Link to="/talent" className={linkClasses("/talent")}>Talent</Link>
      <Link to="/locations" className={linkClasses("/locations")}>Locations</Link>
      <Link to="/pulls" className={linkClasses("/pulls")}>Pulls</Link>
      <Link to="/import-products" className={linkClasses("/import-products")}>Import</Link>
      <div className="ml-auto flex items-center gap-4">
        {user && (
          <span className="text-gray-700 text-sm">{user.displayName || user.email}</span>
        )}
        {user && (
          <button
            onClick={() => signOut(auth)}
            className="text-gray-500 hover:text-primary text-sm"
          >
            Sign out
          </button>
        )}
      </div>
    </nav>
  );
}
