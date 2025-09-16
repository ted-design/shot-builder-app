// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

// Read env vars defensively to keep builds working without secrets.
// If secrets are missing (e.g., forks, local without .env), provide safe fallbacks.
function readEnv(name, fallback = "") {
  try {
    const env = (import.meta && import.meta.env) ? import.meta.env : {};
    const val = env[name];
    return (val == null ? fallback : val);
  } catch {
    return fallback;
  }
}

const firebaseConfig = {
  apiKey: readEnv("VITE_FIREBASE_API_KEY"),
  authDomain: readEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: readEnv("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: readEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: readEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: readEnv("VITE_FIREBASE_APP_ID"),
  measurementId: readEnv("VITE_FIREBASE_MEASUREMENT_ID", ""), // optional
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Upload helper: returns {downloadURL, path}.
export async function uploadImageFile(file, { folder, id, filename }) {
  if (!file) throw new Error("No file provided");
  const safeName =
    filename || `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
  const path = `images/${folder}/${id}/${safeName}`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, file, { contentType: file.type });
  const downloadURL = await getDownloadURL(ref);
  return { downloadURL, path };
}

// Delete helper: remove file by storage path.
export async function deleteImageByPath(path) {
  if (!path) return;
  const ref = storageRef(storage, path);
  await deleteObject(ref);
}
