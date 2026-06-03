import React from "react"
import { createRoot } from "react-dom/client"
import { HashRouter } from "react-router-dom"
import { AppRoutes } from "./routes"
import { AppProviders } from "./providers"

const rootElement = document.getElementById("root")

if (!rootElement) {
  throw new Error("Root element #root was not found")
}

createRoot(rootElement).render(
  <React.StrictMode>
    <AppProviders>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AppProviders>
  </React.StrictMode>
)
