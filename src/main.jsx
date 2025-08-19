import React from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import App from "./App.jsx"
import { Toaster } from "./components/ui/toaster.jsx"
import { queryClient } from "./lib/queryClient.js"

// Import the global Tailwind stylesheet
import "./index.css"

const rootEl = document.getElementById("root")

createRoot(rootEl).render(
  <QueryClientProvider client={queryClient}>
    <App />
    <Toaster />
    <ReactQueryDevtools initialIsOpen={false} />
  </QueryClientProvider>
)