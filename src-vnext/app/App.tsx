import { BrowserRouter } from "react-router-dom"
import { Toaster } from "sonner"
import { AuthProvider } from "@/app/providers/AuthProvider"
import { ThemeProvider } from "@/app/providers/ThemeProvider"
import { SearchCommandProvider } from "@/app/providers/SearchCommandProvider"
import { AppRoutes } from "@/app/routes"

export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <SearchCommandProvider>
            <AppRoutes />
            <Toaster position="bottom-right" richColors closeButton />
          </SearchCommandProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
