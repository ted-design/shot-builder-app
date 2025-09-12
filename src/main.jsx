import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { FLAGS } from "./lib/flags";
import AuthProviderGated from "./context/AuthProviderGated";
import AuthDebugBadge from "./components/AuthDebugBadge";
import "./index.css";

const rootEl = document.getElementById("root");

function Root() {
  return (
    <AuthProviderGated>
      <App />
      {/* Gated debug badge: requires flag and ?authBadge=1 */}
      {FLAGS.newAuthContext && <AuthDebugBadge />}
    </AuthProviderGated>
  );
}

createRoot(rootEl).render(<Root />);
