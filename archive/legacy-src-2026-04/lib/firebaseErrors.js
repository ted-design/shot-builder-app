export function describeFirebaseError(error, fallbackMessage = "Firebase request failed") {
  const code = typeof error?.code === "string" ? error.code : "unknown";
  const message = error?.message || fallbackMessage;
  return { code, message };
}

export function formatFirebaseError(error, fallbackMessage) {
  const { code, message } = describeFirebaseError(error, fallbackMessage);
  return `${code}: ${message}`;
}
