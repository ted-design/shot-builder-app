import { BrowserRouter } from "react-router-dom"
import { Toaster } from "sonner"
import { AuthProvider } from "@/app/providers/AuthProvider"
import { ThemeProvider } from "@/app/providers/ThemeProvider"
import { AppRoutes } from "@/app/routes"

export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
          <Toaster position="bottom-right" richColors closeButton />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
