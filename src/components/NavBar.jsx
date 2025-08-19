import React, { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { signOut } from "firebase/auth"
import { Menu, X, LogOut, Settings } from "lucide-react"
import { auth } from "../firebase"
import { useAuthContext } from "../contexts/AuthContext"
import { Button } from "./ui/button"
import { cn } from "../lib/utils"

export default function NavBar() {
  const { pathname } = useLocation()
  const { user, role } = useAuthContext()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const linkClass = (path) =>
    cn(
      "px-3 py-2 rounded-md text-sm font-medium transition-colors",
      "hover:text-primary hover:bg-primary/10",
      pathname.startsWith(path) 
        ? "text-primary bg-primary/10" 
        : "text-gray-700 hover:text-gray-900"
    )

  const navigationItems = [
    { path: "/projects", label: "Projects", roles: ["admin", "producer", "editor", "viewer"] },
    { path: "/shots", label: "Shots", roles: ["admin", "producer", "editor"] },
    { path: "/planner", label: "Planner", roles: ["admin", "producer", "editor"] },
    { path: "/products", label: "Products", roles: ["admin", "producer", "editor", "catalog", "viewer"] },
    { path: "/talent", label: "Talent", roles: ["admin", "producer", "editor"] },
    { path: "/locations", label: "Locations", roles: ["admin", "producer", "editor"] },
    { path: "/pull-requests", label: "Pull Requests", roles: ["admin", "producer", "editor", "warehouse"] },
  ]

  const visibleItems = navigationItems.filter(item => 
    !role || item.roles.includes(role)
  )

  const NavLinks = () => (
    <>
      {visibleItems.map(item => (
        <Link 
          key={item.path}
          to={item.path} 
          className={linkClass(item.path)}
          onClick={() => setIsMobileMenuOpen(false)}
        >
          {item.label}
        </Link>
      ))}
      {role === 'admin' && (
        <Link 
          to="/admin" 
          className={linkClass("/admin")}
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <Settings className="h-4 w-4 inline mr-1" />
          Admin
        </Link>
      )}
    </>
  )

  return (
    <nav className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo and mobile toggle */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
            
            <Link 
              to="/projects" 
              className="flex items-center space-x-2 font-bold text-xl text-gray-900"
            >
              <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">SB</span>
              </div>
              <span className="hidden sm:block">Shot Builder</span>
            </Link>
          </div>

          {/* Desktop navigation */}
          <div className="hidden md:flex items-center space-x-1">
            <NavLinks />
          </div>

          {/* User menu */}
          <div className="flex items-center gap-3">
            {user && (
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  {user.displayName || user.email}
                </span>
                {role && (
                  <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700 capitalize">
                    {role}
                  </span>
                )}
              </div>
            )}
            
            {user && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => signOut(auth)}
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            )}
          </div>
        </div>

        {/* Mobile navigation menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 py-4">
            <div className="flex flex-col space-y-2">
              <NavLinks />
              
              {user && (
                <div className="pt-4 border-t border-gray-200 mt-4">
                  <div className="text-sm text-gray-600 mb-2">
                    {user.displayName || user.email}
                    {role && (
                      <span className="ml-2 px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700 capitalize">
                        {role}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}