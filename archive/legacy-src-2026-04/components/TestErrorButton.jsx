import { useState } from "react";

/**
 * Temporary test component for Sentry integration
 * Remove this file after testing
 */
function TestErrorButton() {
  const [shouldError, setShouldError] = useState(false);

  if (shouldError) {
    throw new Error("🧪 Test error for Sentry - This is intentional!");
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setShouldError(true)}
        className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-red-700"
      >
        🧪 Test Sentry Error
      </button>
    </div>
  );
}

export default TestErrorButton;
