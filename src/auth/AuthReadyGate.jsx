import React, { useEffect, useState } from "react";
import { FLAGS } from "../lib/flags";
import { useAuth } from "../context/AuthContext";

export default function AuthReadyGate({ children, fallback = null }) {
  // Always call hooks at the top-level to satisfy the hooks rules.
  const { initializing, loadingClaims, ready } = useAuth();
  const useNewAuthContext = FLAGS.newAuthContext;
  const derivedReady = useNewAuthContext
    ? typeof ready === "boolean"
      ? ready
      : !(initializing || loadingClaims)
    : true;
  const [hasRenderedContent, setHasRenderedContent] = useState(() => derivedReady);

  useEffect(() => {
    if (derivedReady) {
      setHasRenderedContent(true);
    }
  }, [derivedReady]);

  if (!useNewAuthContext) {
    return <>{children}</>;
  }

  return (
    <>
      {hasRenderedContent && children}
      {!derivedReady && fallback}
    </>
  );
}
