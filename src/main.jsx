import React, { Suspense } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { FLAGS } from "./lib/flags";
const AuthProviderLazy = React.lazy(() =>
  import("./context/AuthContext").then(m => ({ default: m.AuthProvider }))
);

// Import the global Tailwind stylesheet so utility classes and your custom
// palette are included in the Vite bundle. Without this import, classes
// like `bg-primary` or `rounded-xl` have no corresponding CSS and the UI
// appears unstyled.
import "./index.css";

const rootEl = document.getElementById("root");
const Root = FLAGS.newAuthContext ? (
  <Suspense fallback={null}>
    <AuthProviderLazy>
      <App />
    </AuthProviderLazy>
  </Suspense>
) : <App />;

createRoot(rootEl).render(Root);
