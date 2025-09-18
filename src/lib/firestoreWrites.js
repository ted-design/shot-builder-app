import { describeFirebaseError } from "./firebaseErrors";

export async function writeDoc(action, fn) {
  try {
    return await fn();
  } catch (error) {
    const { code, message } = describeFirebaseError(error, action);
    console.error(`[Firestore] ${action} failed (${code}): ${message}`, error);
    throw error;
  }
}
