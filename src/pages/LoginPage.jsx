import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithPopup } from "firebase/auth";
import { auth, provider } from "../firebase";

export default function LoginPage() {
  const nav = useNavigate();

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(u => {
      if (u) nav("/projects", { replace: true });  // go to Projects after sign-in
    });
    return () => unsub();
  }, [nav]);

  const login = async () => {
    await signInWithPopup(auth, provider);
    // onAuthStateChanged above will do the redirect
  };

  // If user is already signed in, we’ll immediately navigate away in the effect.
  return (
    <div style={{display:"grid",placeItems:"center",height:"100vh"}}>
      <div style={{display:"grid",gap:12,padding:24,border:"1px solid #ddd",borderRadius:12}}>
        <h1>Sign in</h1>
        <button onClick={login}>Continue with Google</button>
      </div>
    </div>
  );
}
