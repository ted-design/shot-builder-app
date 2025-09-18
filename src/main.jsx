import "./bootstrap/flagUrl";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { FLAGS } from "./lib/flags";
import AuthProviderGated from "./context/AuthProviderGated";
import AuthDebugBadge from "./components/AuthDebugBadge";
import ErrorBoundary from "./components/ErrorBoundary";
import ToastProvider from "./components/ui/ToastProvider";
import "./index.css";

const rootEl = document.getElementById("root");

function Root() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProviderGated>
          <App />
          {/* Gated debug badge: requires flag and ?authBadge=1 */}
          {FLAGS.newAuthContext && <AuthDebugBadge />}
        </AuthProviderGated>
      </ToastProvider>
    </ErrorBoundary>
  );
}

createRoot(rootEl).render(<Root />);
