# Auth Boot Diagnostics — Cache Header Verification

After every Firebase Hosting deploy, run these curl commands to verify
cache headers are correct. Replace `DOMAIN` with the production domain
(e.g., `app.shotbuilder.com` or the Firebase default domain).

## Precedence Model

Firebase Hosting merges ALL matching header blocks for a given request URL.
When the same header key appears in multiple matching blocks, the **last
matching block in the array wins**.

Our `firebase.json` ordering exploits this:

| Position | Source pattern | Cache-Control | Why |
|----------|---------------|---------------|-----|
| 1 | `**` | `no-store, max-age=0` | Default for all URLs (SPA routes, etc.) |
| 2 | `/index.html` | `no-store, max-age=0` | Reinforces no-store for direct `/index.html` requests |
| 3 | `/404.html` | `no-store, max-age=0` | Reinforces no-store for the 404 fallback |
| 4 | `/assets/**/*.@(js\|mjs)` | `immutable, 1yr` | Overrides `**` for hashed JS modules |
| 5 | `/assets/**` | `immutable, 1yr` | Overrides `**` for all hashed assets |
| 6 | `**/*.@(js\|css)` | `immutable, 1yr` | Overrides `**` for any JS/CSS (including root-level) |
| 7 | `**/*.@(png\|jpg\|…)` | `immutable, 1yr` | Overrides `**` for images/fonts |

Under last-match-wins:
- `/login` matches only rule 1 → `no-store` (correct)
- `/assets/index-XYZ.js` matches rules 1, 4, 5, 6 → last is 6 → `immutable` (correct)
- `/assets/missing.js` (not on disk) → rewritten to `/404.html` by rewrite rule → headers matched against original URL `/assets/missing.js` → matches rules 1, 5, 6 → last is 6 → `immutable` (note: this is the rewrite response body from 404.html, but with asset headers; see "edge case" below)

### Edge Case: missing /assets/** and Cache-Control

Firebase Hosting applies header rules based on the **original request URL**, not the
rewritten destination. A request for `/assets/missing.js` triggers the `/assets/**`
rewrite to `/404.html`, but headers are matched against `/assets/missing.js`. This means
the response body is `404.html` but Cache-Control comes from the `/assets/**` rule (immutable).

In practice this is acceptable: the missing file had a content-hash filename that will
never be requested again after the next deploy. The `X-Content-Type-Options: nosniff`
header prevents the browser from executing the HTML body as JavaScript.

## Curl Verification Commands

### 1. SPA route (e.g., /login)

```bash
curl -sI "https://DOMAIN/login" | grep -iE "^(cache-control|content-type|x-content-type)"
```

**Expected:**
```
cache-control: no-store, max-age=0
content-type: text/html; charset=utf-8
x-content-type-options: nosniff
```

### 2. Hashed JS asset (use a real filename from latest build)

```bash
# Get the entry JS filename from the built index.html:
grep -oP 'src="/assets/index-[^"]+' dist/index.html

# Then curl it:
curl -sI "https://DOMAIN/assets/index-HASH.js" | grep -iE "^(cache-control|content-type|x-content-type)"
```

**Expected:**
```
cache-control: public, max-age=31536000, immutable
content-type: application/javascript; charset=utf-8
x-content-type-options: nosniff
```

### 3. Missing asset (simulates stale shell referencing old hash)

```bash
curl -sI "https://DOMAIN/assets/does-not-exist-abc123.js" | grep -iE "^(cache-control|content-type|x-content-type|http/)"
```

**Expected:**
- Response body is the contents of `404.html` (NOT `index.html`)
- Status may be 200 (Firebase rewrites always return 200 for the destination file)
- `content-type: text/html` (because the body is 404.html)
- `x-content-type-options: nosniff` (prevents browser from executing HTML as JS)
- Cache-Control will be `immutable` due to header matching on original URL (see edge case above); this is acceptable since the hashed filename is ephemeral

To confirm the body is 404.html and NOT index.html:
```bash
curl -s "https://DOMAIN/assets/does-not-exist-abc123.js" | head -5
```

**Expected body snippet:**
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
```
(Should say "Not Found - Shot Builder" in the title, NOT "Shot Builder" alone.)

## What To Do If Results Differ

### Problem: /login shows `immutable` instead of `no-store`
Firebase may be using first-match-wins instead of last-match-wins.
**Fix:** Reverse the order — move `**` to the LAST position in the headers array.
Then re-deploy and re-test.

### Problem: /assets/*.js shows `no-store` instead of `immutable`
Firebase may be using first-match-wins and `**` at position 1 is winning.
**Fix:** Move `**` to the LAST position. This makes first-match hit the
specific asset rule. Then re-deploy and re-test.

### Problem: /assets/missing.js returns index.html body (not 404.html)
The rewrite rule for `/assets/**` → `/404.html` is not first-match.
**Fix:** Ensure `/assets/**` rewrite appears BEFORE `**` in `hosting.rewrites`.

### Nuclear option: if neither ordering works
Remove `Cache-Control` from the `**` rule entirely and instead add explicit
`no-store` rules for known SPA route patterns:
```json
{ "source": "/@(login|projects|shots|products|talent|locations|library|admin|pulls|settings)/**" }
{ "source": "/@(login|projects|shots|products|talent|locations|library|admin|pulls|settings)" }
```
This avoids any conflict with asset patterns but requires updating when new routes are added.
