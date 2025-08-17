// src/components/NavBar.jsx
import { Link, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

export default function NavBar({ user }) {
  const { pathname } = useLocation();
  const active = (p) => (pathname.startsWith(p) ? { fontWeight: 700 } : {});

  return (
    <nav style={{display:"flex",gap:16,alignItems:"center",padding:"12px 16px",borderBottom:"1px solid #eee"}}>
      <Link to="/shots" style={active("/shots")}>Shots</Link>
      <Link to="/planner" style={active("/planner")}>Planner</Link>
      <Link to="/projects" style={active("/projects")}>Projects</Link>
      <Link to="/products" style={active("/products")}>Products</Link>
      <Link to="/talent" style={active("/talent")}>Talent</Link>
      <Link to="/locations" style={active("/locations")}>Locations</Link>
      <Link to="/pulls" style={active("/pulls")}>Pulls</Link>
      {/* ✅ New Import link */}
      <Link to="/import-products" style={active("/import-products")}>Import</Link>
      <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:12}}>
        {user && <span style={{opacity:0.8}}>{user.displayName || user.email}</span>}
        {user && <button onClick={() => signOut(auth)}>Sign out</button>}
      </div>
    </nav>
  );
}
