import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
} from "firebase/firestore";
import {
  connectFunctionsEmulator,
  getFunctions,
} from "firebase/functions";
import {
  connectStorageEmulator,
  deleteObject,
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";

type FirebaseEnvKey =
  | "VITE_FIREBASE_API_KEY"
  | "VITE_FIREBASE_AUTH_DOMAIN"
  | "VITE_FIREBASE_PROJECT_ID"
  | "VITE_FIREBASE_STORAGE_BUCKET"
  | "VITE_FIREBASE_MESSAGING_SENDER_ID"
  | "VITE_FIREBASE_APP_ID"
  | "VITE_FIREBASE_MEASUREMENT_ID";

type RequiredEnvKey = Exclude<FirebaseEnvKey, "VITE_FIREBASE_MEASUREMENT_ID">;

const REQUIRED_ENV_KEYS: RequiredEnvKey[] = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
];

const rawEnv = (typeof import.meta !== "undefined" ? import.meta.env : {}) as Record<
  string,
  string | undefined
>;

function readRawEnv(key: string): string | undefined {
  const value = rawEnv?.[key];
  return value && value.trim().length > 0 ? value : undefined;
}

function readEnv(key: FirebaseEnvKey): string | undefined {
  return readRawEnv(key);
}

function readBoolEnv(key: string): boolean {
  const value = readRawEnv(key);
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function readNumberEnv(key: string, fallback: number): number {
  const value = readRawEnv(key);
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

type MissingEnvInfo = {
  missing: RequiredEnvKey[];
  optionalMissing: FirebaseEnvKey[];
};

function getFirebaseOptions(): { options: FirebaseOptions; missing: MissingEnvInfo } {
  const missing: MissingEnvInfo = { missing: [], optionalMissing: [] };

  const options: FirebaseOptions = {
    apiKey: readEnv("VITE_FIREBASE_API_KEY"),
    authDomain: readEnv("VITE_FIREBASE_AUTH_DOMAIN"),
    projectId: readEnv("VITE_FIREBASE_PROJECT_ID"),
    storageBucket: readEnv("VITE_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: readEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
    appId: readEnv("VITE_FIREBASE_APP_ID"),
  };

  if (!options.apiKey) missing.missing.push("VITE_FIREBASE_API_KEY");
  if (!options.authDomain) missing.missing.push("VITE_FIREBASE_AUTH_DOMAIN");
  if (!options.projectId) missing.missing.push("VITE_FIREBASE_PROJECT_ID");
  if (!options.storageBucket) missing.missing.push("VITE_FIREBASE_STORAGE_BUCKET");
  if (!options.messagingSenderId) missing.missing.push("VITE_FIREBASE_MESSAGING_SENDER_ID");
  if (!options.appId) missing.missing.push("VITE_FIREBASE_APP_ID");

  const measurementId = readEnv("VITE_FIREBASE_MEASUREMENT_ID");
  if (measurementId) {
    options.measurementId = measurementId;
  } else {
    missing.optionalMissing.push("VITE_FIREBASE_MEASUREMENT_ID");
  }

  return { options, missing };
}

const { options: firebaseConfig, missing } = getFirebaseOptions();

if (missing.missing.length > 0) {
  const warning = `Missing Firebase env vars: ${missing.missing.join(", ")}.`;
  if (import.meta.env.PROD) {
    throw new Error(`${warning} Production builds require all Firebase keys.`);
  }
  console.warn(
    `[Firebase] ${warning} Calls to Auth/Firestore/Storage will fail until the .env.local values are set.`,
  );
}

if (missing.optionalMissing.length > 0 && import.meta.env.DEV) {
  console.info(
    `[Firebase] Optional env vars missing: ${missing.optionalMissing.join(", ")}. Analytics remains disabled.`,
  );
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

const useEmulators = import.meta.env.DEV && readBoolEnv("VITE_USE_FIREBASE_EMULATORS");

if (useEmulators) {
  const host = readRawEnv("VITE_FIREBASE_EMULATOR_HOST") ?? "localhost";
  const authPort = readNumberEnv("VITE_FIREBASE_AUTH_EMULATOR_PORT", 9099);
  const firestorePort = readNumberEnv("VITE_FIREBASE_FIRESTORE_EMULATOR_PORT", 8080);
  const functionsPort = readNumberEnv("VITE_FIREBASE_FUNCTIONS_EMULATOR_PORT", 5001);
  const storagePort = readNumberEnv("VITE_FIREBASE_STORAGE_EMULATOR_PORT", 9199);

  console.info(
    `[Firebase] Connecting to local emulators at ${host} (auth:${authPort}, firestore:${firestorePort}, functions:${functionsPort}, storage:${storagePort}).`,
  );

  try {
    connectAuthEmulator(auth, `http://${host}:${authPort}`, { disableWarnings: true });
  } catch (err) {
    console.warn("[Firebase] Failed to connect Auth emulator", err);
  }

  try {
    connectFirestoreEmulator(db, host, firestorePort);
  } catch (err) {
    console.warn("[Firebase] Failed to connect Firestore emulator", err);
  }

  try {
    connectFunctionsEmulator(functions, host, functionsPort);
  } catch (err) {
    console.warn("[Firebase] Failed to connect Functions emulator", err);
  }

  try {
    connectStorageEmulator(storage, host, storagePort);
  } catch (err) {
    console.warn("[Firebase] Failed to connect Storage emulator", err);
  }
}

export async function uploadImageFile(
  file: File,
  { folder, id, filename }: { folder: string; id: string; filename?: string },
): Promise<{ downloadURL: string; path: string }> {
  if (!file) throw new Error("No file provided");
  if (!folder || !id) throw new Error("uploadImageFile requires folder and id");

  const safeName = filename ?? `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
  const path = `images/${folder}/${id}/${safeName}`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, file, { contentType: file.type });
  const downloadURL = await getDownloadURL(ref);
  return { downloadURL, path };
}

export async function deleteImageByPath(path: string | undefined | null): Promise<void> {
  if (!path) return;
  const ref = storageRef(storage, path);
  await deleteObject(ref);
}

export function assertFirebaseProject(expectedProjectId: string): void {
  if (!expectedProjectId) return;
  const configuredId = firebaseConfig.projectId;
  if (configuredId && configuredId !== expectedProjectId) {
    console.warn(
      `Firebase project mismatch. Expected ${expectedProjectId}, but config uses ${configuredId}.`,
    );
  }
}

export const firebaseProjectId = firebaseConfig.projectId;
