// src/firebase.js
// --- Firebase core ---
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

// 1) Replace with your actual config from Firebase Console > Project Settings > General
const firebaseConfig = {
  apiKey: "AIzaSyAMghXkDr-hJHSpzW-HYinKnv8f2F_-Yl0",
  authDomain: "um-shotbuilder.firebaseapp.com",
  projectId: "um-shotbuilder",
  // IMPORTANT: this is the bucket NAME, not a URL
  storageBucket: "um-shotbuilder.appspot.com",
  messagingSenderId: "168065141847",
  appId: "1:168065141847:web:be45c7303aa6f8aff4e712",
  measurementId: "G-0M8WVWZ7PE",
};

// 2) Initialize SDKs
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
// Optional nicety: always show account chooser
provider.setCustomParameters({ prompt: "select_account" });

export const db = getFirestore(app);
export const storage = getStorage(app);

// 3) Helpers for uploads/deletes
// - folder: "products" | "talent" | "locations" | etc.
// - id: Firestore doc id
// Returns: { downloadURL, path } where path is a Storage path you can save on the doc
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

// Delete by the Storage path you saved on the doc (e.g., "images/products/abc/file.jpg")
export async function deleteImageByPath(path) {
  if (!path) return;
  const ref = storageRef(storage, path);
  await deleteObject(ref);
}
