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
import { getPerformance } from "firebase/performance";
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
} from "firebase/app-check";
import { compressImageFile } from "./imageCompression";
import { isDemoModeActive } from "./flags";

type FirebaseEnvKey =
  | "VITE_FIREBASE_API_KEY"
  | "VITE_FIREBASE_AUTH_DOMAIN"
  | "VITE_FIREBASE_PROJECT_ID"
  | "VITE_FIREBASE_STORAGE_BUCKET"
  | "VITE_FIREBASE_MESSAGING_SENDER_ID"
  | "VITE_FIREBASE_APP_ID"
  | "VITE_FIREBASE_MEASUREMENT_ID"
  | "VITE_FIREBASE_APPCHECK_RECAPTCHA_SITE_KEY";

type RequiredEnvKey = Exclude<
  FirebaseEnvKey,
  "VITE_FIREBASE_MEASUREMENT_ID" | "VITE_FIREBASE_APPCHECK_RECAPTCHA_SITE_KEY"
>;

const REQUIRED_ENV_KEYS: RequiredEnvKey[] = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
];

// Read Vite-provided env at build time so the values are inlined into the
// production bundle. Avoid checking `import.meta.env` at runtime because in
// optimized builds the guard can evaluate false even when values were
// statically injected at build time.
const viteEnv = {
  VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  VITE_FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  VITE_FIREBASE_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
  VITE_FIREBASE_MEASUREMENT_ID: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  VITE_FIREBASE_APPCHECK_RECAPTCHA_SITE_KEY: import.meta.env.VITE_FIREBASE_APPCHECK_RECAPTCHA_SITE_KEY,
  DEV: import.meta.env.DEV,
  PROD: import.meta.env.PROD,
} as const;

// Treat the injected object as our source of truth for key lookups.
const rawEnv: Record<string, string | undefined> = {
  VITE_FIREBASE_API_KEY: viteEnv.VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_AUTH_DOMAIN: viteEnv.VITE_FIREBASE_AUTH_DOMAIN,
  VITE_FIREBASE_PROJECT_ID: viteEnv.VITE_FIREBASE_PROJECT_ID,
  VITE_FIREBASE_STORAGE_BUCKET: viteEnv.VITE_FIREBASE_STORAGE_BUCKET,
  VITE_FIREBASE_MESSAGING_SENDER_ID: viteEnv.VITE_FIREBASE_MESSAGING_SENDER_ID,
  VITE_FIREBASE_APP_ID: viteEnv.VITE_FIREBASE_APP_ID,
  VITE_FIREBASE_MEASUREMENT_ID: viteEnv.VITE_FIREBASE_MEASUREMENT_ID,
  VITE_FIREBASE_APPCHECK_RECAPTCHA_SITE_KEY: viteEnv.VITE_FIREBASE_APPCHECK_RECAPTCHA_SITE_KEY,
  // Directly inline emulator flag to avoid reference chain issues during minification
  VITE_USE_FIREBASE_EMULATORS: import.meta.env.VITE_USE_FIREBASE_EMULATORS,
};

// Use MODE instead of DEV/PROD which seem to be unreliable
const mode = import.meta.env.MODE || 'development';
const isProd = mode === 'production';
const isDev = !isProd;

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

  if (typeof window !== "undefined" && isProd) {
    const host = window.location?.hostname;
    const configuredAuthDomain = options.authDomain;
    const shouldPreferSameSiteAuthDomain =
      typeof host === "string" &&
      host.length > 0 &&
      host.endsWith("immediategroup.ca") &&
      typeof configuredAuthDomain === "string" &&
      (configuredAuthDomain.endsWith(".firebaseapp.com") || configuredAuthDomain.endsWith(".web.app"));

    if (shouldPreferSameSiteAuthDomain) {
      options.authDomain = host;
    }
  }

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
  if (isProd) {
    throw new Error(`${warning} Production builds require all Firebase keys.`);
  }
  console.warn(
    `[Firebase] ${warning} Calls to Auth/Firestore/Storage will fail until the required VITE_* environment variables are provided.`,
  );
}

if (missing.optionalMissing.length > 0 && isDev) {
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

// Force Firestore to use fresh auth tokens
// This ensures Firestore re-authenticates when custom claims are updated
if (typeof window !== 'undefined') {
  import('firebase/firestore').then(({ terminate, initializeFirestore, CACHE_SIZE_UNLIMITED }) => {
    // Listen for auth changes and force Firestore to reconnect
    auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          // Force token refresh to ensure we have latest claims
          await user.getIdToken(true);
          console.log('🔄 [Firebase] Auth token refreshed for Firestore');
        } catch (err) {
          // Ignore IDB errors that occur when navigating away during auth
          // These are benign race conditions and don't affect functionality
          const isIDBClosingError =
            err instanceof DOMException &&
            err.name === 'InvalidStateError' &&
            err.message?.includes('database connection is closing');

          if (!isIDBClosingError) {
            console.error('❌ [Firebase] Failed to refresh token:', err);
          }
        }
      }
    });
  });
}

// Initialize Firebase Performance Monitoring
// Automatically tracks page load, network requests, and custom traces
export const performance = isProd ? getPerformance(app) : null;

// Check if emulators should be used
// Allow emulators in any build mode when explicitly requested
// This is critical for E2E testing with production builds
const useEmulators = readBoolEnv("VITE_USE_FIREBASE_EMULATORS");

// Initialize Firebase App Check
// Protects backend resources from abuse and unauthorized access
// Skip App Check when using emulators to avoid Installations API errors
const appCheckSiteKey = readEnv("VITE_FIREBASE_APPCHECK_RECAPTCHA_SITE_KEY");
if (appCheckSiteKey && isProd && !useEmulators) {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
    console.info("[Firebase] App Check initialized with reCAPTCHA v3");
  } catch (error) {
    console.error("[Firebase] Failed to initialize App Check:", error);
  }
} else if (isDev) {
  console.info("[Firebase] App Check disabled in development mode");
} else if (useEmulators) {
  console.info("[Firebase] App Check disabled in emulator mode");
} else if (!appCheckSiteKey) {
  console.warn(
    "[Firebase] App Check not initialized: VITE_FIREBASE_APPCHECK_RECAPTCHA_SITE_KEY is missing",
  );
}

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
  {
    folder,
    id,
    filename,
    optimize = true,
  }: { folder: string; id: string; filename?: string; optimize?: boolean },
): Promise<{ downloadURL: string; path: string }> {
  if (!file) throw new Error("No file provided");
  if (!folder || !id) throw new Error("uploadImageFile requires folder and id");

  // Demo mode: return fake URL without uploading
  if (isDemoModeActive()) {
    console.info("[Demo Mode] Image upload blocked, returning preview URL");
    const fakeUrl = URL.createObjectURL(file);
    const fakePath = `demo/images/${folder}/${id}/${Date.now()}-${file.name}`;
    return { downloadURL: fakeUrl, path: fakePath };
  }

  // Standardize all image uploads through the same optimization pipeline (WebP conversion)
  const shouldOptimize = optimize !== false && typeof file.type === "string" && file.type.startsWith("image/");
  const optimized = shouldOptimize ? await compressImageFile(file, { convertToWebP: true }) : file;

  const baseName = optimized.name || file.name || "upload";
  const safeName = filename ?? `${Date.now()}-${baseName.replace(/\s+/g, "_")}`;
  const path = `images/${folder}/${id}/${safeName}`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, optimized, { contentType: optimized.type || file.type });
  const downloadURL = await getDownloadURL(ref);
  return { downloadURL, path };
}

export async function deleteImageByPath(path: string | undefined | null): Promise<void> {
  if (!path) return;

  // Demo mode: no-op
  if (isDemoModeActive()) {
    console.info("[Demo Mode] Image delete blocked for:", path);
    return;
  }

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
export const firebaseAuthDomain = firebaseConfig.authDomain;

// Performance Monitoring Utilities
// Use these to create custom traces for measuring operation performance

/**
 * Creates a custom trace to measure performance of an async operation
 * @param traceName - Name of the trace (e.g., "load_products", "create_shot")
 * @param operation - Async function to measure
 * @returns Result of the operation
 * @example
 * const products = await measurePerformance("load_products", async () => {
 *   return await fetchProducts();
 * });
 */
export async function measurePerformance<T>(
  traceName: string,
  operation: () => Promise<T>,
): Promise<T> {
  if (!performance) {
    // Performance monitoring disabled in dev, just run the operation
    return await operation();
  }

  const { trace } = await import("firebase/performance");
  const customTrace = trace(performance, traceName);

  customTrace.start();
  try {
    const result = await operation();
    customTrace.stop();
    return result;
  } catch (error) {
    customTrace.stop();
    throw error;
  }
}

/**
 * Adds a custom metric to track specific values
 * @param traceName - Name of the trace
 * @param metricName - Name of the metric (e.g., "item_count", "file_size")
 * @param value - Numeric value to record
 * @example
 * recordMetric("load_products", "product_count", products.length);
 */
export function recordMetric(traceName: string, metricName: string, value: number): void {
  if (!performance) return;

  import("firebase/performance").then(({ trace }) => {
    const customTrace = trace(performance, traceName);
    customTrace.putMetric(metricName, value);
  });
}
