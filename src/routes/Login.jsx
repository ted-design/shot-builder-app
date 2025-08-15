{\rtf1\ansi\ansicpg1252\cocoartf2822
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 import React, \{ useEffect \} from "react";\
import \{ useNavigate \} from "react-router-dom";\
import \{ getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged \} from "firebase/auth";\
\
export default function Login() \{\
  const auth = getAuth();\
  const navigate = useNavigate();\
\
  useEffect(() => \{\
    // If already logged in, jump to /shots\
    const unsub = onAuthStateChanged(auth, (u) => \{\
      if (u) navigate("/shots", \{ replace: true \});\
    \});\
    return () => unsub();\
  \}, [auth, navigate]);\
\
  async function login() \{\
    const provider = new GoogleAuthProvider();\
    await signInWithPopup(auth, provider);\
    // onAuthStateChanged will fire and navigate for us\
  \}\
\
  return (\
    <div style=\{\{ minHeight: "100vh" \}\} className="flex items-center justify-center">\
      <div className="flex flex-col gap-3 items-center">\
        <h1 className="text-xl font-semibold">Shot Builder</h1>\
        <button className="rounded-xl bg-black text-white px-4 py-2" onClick=\{login\}>\
          Sign in with Google\
        </button>\
      </div>\
    </div>\
  );\
\}\
}