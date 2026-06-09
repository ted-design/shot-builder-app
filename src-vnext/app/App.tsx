import { BrowserRouter } from "react-router-dom"
import { Toaster } from "sonner"
import { AuthProvider } from "@/app/providers/AuthProvider"
import { ThemeProvider } from "@/app/providers/ThemeProvider"
import { SearchCommandProvider } from "@/app/providers/SearchCommandProvider"
import { TooltipProvider } from "@/ui/tooltip"
import { AppRoutes } from "@/app/routes"

export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <SearchCommandProvider>
            <TooltipProvider delayDuration={200}>
              <AppRoutes />
              <Toaster position="bottom-right" richColors closeButton />
            </TooltipProvider>
          </SearchCommandProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
