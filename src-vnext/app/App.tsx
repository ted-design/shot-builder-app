import { BrowserRouter } from "react-router-dom"
import { Toaster } from "sonner"
import { AuthProvider } from "@/app/providers/AuthProvider"
import { ThemeProvider } from "@/app/providers/ThemeProvider"
import { SearchCommandProvider } from "@/app/providers/SearchCommandProvider"
// 5e-III: in-memory "View as" preview provider (no persistence)
import { ViewAsPreviewProvider } from "@/app/providers/ViewAsPreviewProvider"
import { TooltipProvider } from "@/ui/tooltip"
import { AppRoutes } from "@/app/routes"

export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <SearchCommandProvider>
            {/* 5e-III: View-as preview state — in-memory only, consumers under it need auth too */}
            <ViewAsPreviewProvider>
              <TooltipProvider delayDuration={200}>
                <AppRoutes />
                <Toaster position="bottom-right" richColors closeButton />
              </TooltipProvider>
            </ViewAsPreviewProvider>
          </SearchCommandProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
