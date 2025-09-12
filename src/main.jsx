import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { FLAGS } from "./lib/flags";
import { AuthProvider } from "./context/AuthContext";
import "./index.css";

const rootEl = document.getElementById("root");

function Root() {
  if (FLAGS.newAuthContext) {
    return (
      <AuthProvider>
        <App />
      </AuthProvider>
    );
  }
  return <App />;
}

createRoot(rootEl).render(<Root />);
