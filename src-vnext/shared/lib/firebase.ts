import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app"
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
} from "firebase/auth"
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore"
import {
  connectFunctionsEmulator,
  getFunctions,
} from "firebase/functions"
import {
  connectStorageEmulator,
  getStorage,
} from "firebase/storage"

type FirebaseEnvKey =
  | "VITE_FIREBASE_API_KEY"
  | "VITE_FIREBASE_AUTH_DOMAIN"
  | "VITE_FIREBASE_PROJECT_ID"
  | "VITE_FIREBASE_STORAGE_BUCKET"
  | "VITE_FIREBASE_MESSAGING_SENDER_ID"
  | "VITE_FIREBASE_APP_ID"
  | "VITE_FIREBASE_MEASUREMENT_ID"
  | "VITE_FIREBASE_APPCHECK_RECAPTCHA_SITE_KEY"

type RequiredEnvKey = Exclude<
  FirebaseEnvKey,
  "VITE_FIREBASE_MEASUREMENT_ID" | "VITE_FIREBASE_APPCHECK_RECAPTCHA_SITE_KEY"
>

const REQUIRED_ENV_KEYS: RequiredEnvKey[] = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
]

const viteEnv = {
  VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  VITE_FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  VITE_FIREBASE_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
  VITE_FIREBASE_MEASUREMENT_ID: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  VITE_FIREBASE_APPCHECK_RECAPTCHA_SITE_KEY: import.meta.env.VITE_FIREBASE_APPCHECK_RECAPTCHA_SITE_KEY,
} as const

const rawEnv: Record<string, string | undefined> = {
  VITE_FIREBASE_API_KEY: viteEnv.VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_AUTH_DOMAIN: viteEnv.VITE_FIREBASE_AUTH_DOMAIN,
  VITE_FIREBASE_PROJECT_ID: viteEnv.VITE_FIREBASE_PROJECT_ID,
  VITE_FIREBASE_STORAGE_BUCKET: viteEnv.VITE_FIREBASE_STORAGE_BUCKET,
  VITE_FIREBASE_MESSAGING_SENDER_ID: viteEnv.VITE_FIREBASE_MESSAGING_SENDER_ID,
  VITE_FIREBASE_APP_ID: viteEnv.VITE_FIREBASE_APP_ID,
  VITE_FIREBASE_MEASUREMENT_ID: viteEnv.VITE_FIREBASE_MEASUREMENT_ID,
  VITE_FIREBASE_APPCHECK_RECAPTCHA_SITE_KEY: viteEnv.VITE_FIREBASE_APPCHECK_RECAPTCHA_SITE_KEY,
  VITE_USE_FIREBASE_EMULATORS: import.meta.env.VITE_USE_FIREBASE_EMULATORS,
}

const mode = import.meta.env.MODE || "development"
const isProd = mode === "production"

function readRawEnv(key: string): string | undefined {
  const value = rawEnv[key]
  return value && value.trim().length > 0 ? value : undefined
}

function readEnv(key: FirebaseEnvKey): string | undefined {
  return readRawEnv(key)
}

function readBoolEnv(key: string): boolean {
  const value = readRawEnv(key)
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on"
}

function readNumberEnv(key: string, fallback: number): number {
  const value = readRawEnv(key)
  if (!value) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function getFirebaseOptions(): { options: FirebaseOptions; missingKeys: RequiredEnvKey[] } {
  const options: FirebaseOptions = {
    apiKey: readEnv("VITE_FIREBASE_API_KEY"),
    authDomain: readEnv("VITE_FIREBASE_AUTH_DOMAIN"),
    projectId: readEnv("VITE_FIREBASE_PROJECT_ID"),
    storageBucket: readEnv("VITE_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: readEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
    appId: readEnv("VITE_FIREBASE_APP_ID"),
  }

  if (typeof window !== "undefined" && isProd) {
    const host = window.location?.hostname
    const configuredAuthDomain = options.authDomain
    const shouldPreferSameSiteAuthDomain =
      typeof host === "string" &&
      host.length > 0 &&
      host.endsWith("immediategroup.ca") &&
      typeof configuredAuthDomain === "string" &&
      (configuredAuthDomain.endsWith(".firebaseapp.com") ||
        configuredAuthDomain.endsWith(".web.app"))

    if (shouldPreferSameSiteAuthDomain) {
      options.authDomain = host
    }
  }

  const missingKeys = REQUIRED_ENV_KEYS.filter((key) => !readEnv(key))

  const measurementId = readEnv("VITE_FIREBASE_MEASUREMENT_ID")
  if (measurementId) {
    options.measurementId = measurementId
  }

  return { options, missingKeys }
}

const { options: firebaseConfig, missingKeys } = getFirebaseOptions()

if (missingKeys.length > 0) {
  const warning = `Missing Firebase env vars: ${missingKeys.join(", ")}.`
  if (isProd) {
    throw new Error(`${warning} Production builds require all Firebase keys.`)
  }
  console.warn(`[Firebase] ${warning}`)
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const provider = new GoogleAuthProvider()
provider.setCustomParameters({ prompt: "select_account" })
// Decision C (5e-II): durable offline cache, APP-WIDE (cache config cannot be
// feature-flag forked — it is set once per Firestore instance). With the
// default memory cache an offline write was queued in RAM only: the UI showed
// it optimistically and a reload silently LOST it. persistentLocalCache makes
// the queue durable (IndexedDB), so offline status taps / comments survive a
// reload and sync on reconnect — Firestore's standard offline semantics, not
// a custom sync engine. persistentMultipleTabManager avoids the legacy
// single-tab lock failure (second tab would otherwise fail persistence).
// In environments without IndexedDB the SDK falls back to the memory cache
// on its own (warning, not a crash).
function initFirestoreWithDurableCache(): Firestore {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    })
  } catch (error) {
    // Firestore was already initialized for this app (e.g. dev-server HMR
    // re-evaluation) — reuse the existing instance rather than crashing.
    // Only that known case is swallowed; anything else (IndexedDB schema
    // errors, SDK version mismatches) must surface, not silently degrade.
    const code = (error as { code?: string })?.code ?? ""
    const message = error instanceof Error ? error.message : ""
    if (code === "failed-precondition" || message.includes("already")) {
      return getFirestore(app)
    }
    throw error
  }
}

export const db = initFirestoreWithDurableCache()
export const storage = getStorage(app)
export const functions = getFunctions(app, "northamerica-northeast1")

const useEmulators = readBoolEnv("VITE_USE_FIREBASE_EMULATORS")

if (useEmulators) {
  const host = readRawEnv("VITE_FIREBASE_EMULATOR_HOST") ?? "localhost"
  const authPort = readNumberEnv("VITE_FIREBASE_AUTH_EMULATOR_PORT", 9099)
  const firestorePort = readNumberEnv("VITE_FIREBASE_FIRESTORE_EMULATOR_PORT", 8080)
  const functionsPort = readNumberEnv("VITE_FIREBASE_FUNCTIONS_EMULATOR_PORT", 5001)
  const storagePort = readNumberEnv("VITE_FIREBASE_STORAGE_EMULATOR_PORT", 9199)

  try { connectAuthEmulator(auth, `http://${host}:${authPort}`, { disableWarnings: true }) } catch { /* already connected */ }
  try { connectFirestoreEmulator(db, host, firestorePort) } catch { /* already connected */ }
  try { connectFunctionsEmulator(functions, host, functionsPort) } catch { /* already connected */ }
  try { connectStorageEmulator(storage, host, storagePort) } catch { /* already connected */ }
}
