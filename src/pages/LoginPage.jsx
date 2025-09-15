import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithPopup, signInWithRedirect } from "firebase/auth";
import { auth, provider } from "../firebase";

export default function LoginPage() {
  const nav = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(u => {
      if (u) nav("/projects", { replace: true });  // go to Projects after sign-in
    });
    return () => unsub();
  }, [nav]);

  const login = async () => {
    setError("");
    setBusy(true);
    try {
      await signInWithPopup(auth, provider);
      // onAuthStateChanged above will do the redirect
    } catch (e) {
      const code = e && e.code ? String(e.code) : "unknown";
      // Common cases where popup fails: third-party cookies blocked, Safari, or popup blockers.
      // Environments like Safari/ITP or hardened privacy settings often
      // break popup flows. In those cases, fall back to redirect.
      const shouldRedirect = [
        "auth/popup-blocked",
        "auth/operation-not-supported-in-this-environment",
        "auth/cancelled-popup-request",
        "auth/web-storage-unsupported",
        "auth/network-request-failed",
        "auth/internal-error",
      ].includes(code);
      if (shouldRedirect) {
        try {
          await signInWithRedirect(auth, provider);
          return; // page will redirect
        } catch (e2) {
          setError(`Sign-in failed (redirect): ${e2.message || e2}`);
        }
      } else if (code === "auth/unauthorized-domain") {
        setError(
          "This domain is not authorized for OAuth. Ask an admin to add your domain in Firebase Auth > Authorized domains."
        );
      } else if (code === "auth/operation-not-allowed") {
        setError("Google sign-in is disabled for this project. Enable the provider in Firebase Auth.");
      } else {
        setError(`Sign-in failed: ${e.message || e}`);
      }
    } finally {
      setBusy(false);
    }
  };

  const loginRedirect = async () => {
    setError("");
    setBusy(true);
    try {
      await signInWithRedirect(auth, provider);
    } catch (e) {
      setError(`Sign-in (redirect) failed: ${e.message || e}`);
      setBusy(false);
    }
  };

  // If user is already signed in, we’ll immediately navigate away in the effect.
  return (
    <div style={{display:"grid",placeItems:"center",height:"100vh"}}>
      <div style={{display:"grid",gap:12,padding:24,border:"1px solid #ddd",borderRadius:12,minWidth:320}}>
        <h1>Sign in</h1>
        <button onClick={login} disabled={busy}>Continue with Google</button>
        <button onClick={loginRedirect} disabled={busy} style={{opacity:0.85}}>
          Use redirect sign‑in (fallback)
        </button>
        {error && (
          <div style={{color:"#b91c1c", fontSize:12}}>{error}</div>
        )}
      </div>
    </div>
  );
}
