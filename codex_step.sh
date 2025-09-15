set -euo pipefail

echo "→ Branch"
git checkout -b integration/auth-adapter-tests || git checkout integration/auth-adapter-tests

echo "→ Ensure test runner (Vitest) exists or add it"
if ! npm run -s test -- --version >/dev/null 2>&1; then
  npm pkg set scripts.test="vitest run"
  npm pkg set scripts["test:watch"]="vitest"
  npm pkg set scripts["test:ui"]="vitest --ui"
  npm i -D vitest @types/node
fi

echo "→ Create test file for adaptUser()"
mkdir -p src/auth/__tests__
cat > src/auth/__tests__/adapter.test.ts <<'TS'
import { describe, it, expect } from "vitest";
import { adaptUser } from "../adapter";

describe("adaptUser", () => {
  it("maps a Firebase user to the NavBar-friendly shape", () => {
    const u: any = {
      uid: "abc",
      displayName: "Ted",
      email: "ted@example.com",
      photoURL: "http://x/y.jpg",
      emailVerified: true,
      providerData: [{ providerId: "google.com" }, { providerId: "password" }],
    };
    const out = adaptUser(u);
    expect(out).toStrictEqual({
      id: "abc",
      name: "Ted",
      email: "ted@example.com",
      avatarUrl: "http://x/y.jpg",
      verified: true,
      providers: ["google.com", "password"],
    });
  });

  it("returns null for null/undefined input", () => {
    // @ts-expect-error intentional bad input for edge case
    expect(adaptUser(null)).toBeNull();
    // @ts-expect-error intentional bad input for edge case
    expect(adaptUser(undefined)).toBeNull();
  });

  it("handles missing optional fields safely", () => {
    const u: any = { uid: "x1", displayName: null, email: null, photoURL: null, providerData: [] };
    const out = adaptUser(u);
    expect(out).toStrictEqual({
      id: "x1",
      name: null,
      email: null,
      avatarUrl: null,
      verified: false,
      providers: [],
    });
  });
});
TS

echo "→ Run tests"
npm run -s test || (echo "Tests failed—showing logs above" && exit 1)

echo "→ Commit"
git add -A
git commit -m "Tests: unit coverage for adaptUser() (null-handling, mapping, providers)"

echo "→ Push"
git push -u origin integration/auth-adapter-tests

echo "→ Open PR"
gh pr create --base main --head integration/auth-adapter-tests \
  --title "Tests: add unit tests for adaptUser()" \
  --body "Covers happy path, null/undefined, and missing optional fields. Ensures mapping stability before further auth refactors." || true

echo "→ Show PR"
gh pr view --web || true

echo "✓ Done"

