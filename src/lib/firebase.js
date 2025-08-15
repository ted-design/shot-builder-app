// src/lib/firebase.js
//
// This module initializes your Firebase app and exports a Firestore instance.
// If you already have a firebase configuration file elsewhere (e.g. src/lib/firebase.ts
// or src/firebase.js), you can adjust the import in ImportProducts.jsx accordingly
// and delete this file.  The configuration below expects your Firebase keys to be
// provided via Vite environment variables (VITE_FIREBASE_API_KEY, etc.).
//
// NOTE: Replace or extend the config object as needed for your project.  If you
//       are not using Vite, import.meta.env may need to be adjusted (e.g. process.env).

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase only once.  If your app initializes Firebase elsewhere,
// you can import getFirestore from that file instead.
const app = initializeApp(firebaseConfig);

// Export Firestore database instance
export const db = getFirestore(app);
