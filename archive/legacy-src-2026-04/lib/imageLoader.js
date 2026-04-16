const defaultDelay = (attempt) => Math.min(500 * 2 ** attempt, 4000);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function loadImage(url, { crossOrigin = "anonymous", timeoutMs = 12000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error("Missing image URL"));
      return;
    }

    const img = new Image();
    let disposed = false;
    let timer = null;

    const cleanup = () => {
      if (disposed) return;
      disposed = true;
      img.onload = null;
      img.onerror = null;
      img.src = "";
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const handleError = (error) => {
      cleanup();
      reject(error instanceof Error ? error : new Error("Failed to load image"));
    };

    if (crossOrigin) {
      img.crossOrigin = crossOrigin;
    }
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";

    img.onload = () => {
      cleanup();
      resolve(img);
    };

    img.onerror = () => {
      handleError(new Error(`Image failed: ${url}`));
    };

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        handleError(new Error(`Image timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }

    img.src = url;

    if (img.complete && img.naturalWidth > 0) {
      cleanup();
      resolve(img);
    }
  });
}

export async function loadImageWithRetry(
  url,
  {
    retries = 2,
    crossOrigin = "anonymous",
    timeoutMs = 12000,
    delayStrategy = defaultDelay,
  } = {}
) {
  let attempt = 0;
  let lastError = null;
  const totalAttempts = Math.max(0, retries);

  while (attempt <= totalAttempts) {
    try {
      await loadImage(url, { crossOrigin, timeoutMs });
      return url;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === totalAttempts) break;
      const wait = typeof delayStrategy === "function" ? delayStrategy(attempt) : defaultDelay(attempt);
      if (wait > 0) await delay(wait);
    }
    attempt += 1;
  }

  throw lastError || new Error(`Unable to load image ${url}`);
}

export async function withRetry(fn, { retries = 2, delayStrategy = defaultDelay } = {}) {
  let attempt = 0;
  let lastError = null;
  const totalAttempts = Math.max(0, retries);
  while (attempt <= totalAttempts) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === totalAttempts) break;
      const wait = typeof delayStrategy === "function" ? delayStrategy(attempt) : defaultDelay(attempt);
      if (wait > 0) await delay(wait);
    }
    attempt += 1;
  }
  throw lastError ?? new Error("Retry attempts exhausted");
}
