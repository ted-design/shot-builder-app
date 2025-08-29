// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

// Ensure required env vars are defined.
function required(name) {
  const val = import.meta.env[name];
  if (!val) throw new Error(`Missing ${name}. Add it to your .env or CI secrets.`);
  return val;
}

const firebaseConfig = {
  apiKey: required("VITE_FIREBASE_API_KEY"),
  authDomain: required("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: required("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: required("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: required("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: required("VITE_FIREBASE_APP_ID"),
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID, // optional
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });
export const db = getFirestore(app);
export const storage = getStorage(app);

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
