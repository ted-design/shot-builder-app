# Brand Assets

This directory contains Immediate's brand assets for Shot Builder / Production Hub.

## Current Assets (SVG — source of truth)

### Immediate Logos (wordmark, viewBox 1916×200)
- ✅ `immediate-logo-black.svg` — Monochrome `#0E0E0E` wordmark, for light backgrounds. Wired into `LoginPage.tsx` (`dark:hidden`).
- ✅ `immediate-logo-white.svg` — Monochrome `#F5F5F5` wordmark, for dark backgrounds. Wired into `LoginPage.tsx` (`hidden dark:block`).
- ✅ `immediate-logo-dark.svg` — Two-color wordmark (`#EB1400` accent + `#0E0E0E` body), for dark surfaces that want the brand red preserved. Not yet wired into a component.
- ✅ `immediate-logo-light.svg` — Two-color wordmark (`#EB1400` accent + `#F5F5F5` body), for light surfaces that want the brand red preserved. Not yet wired into a component.

### Immediate Icon Marks (viewBox 675×775)
- ✅ `immediate-icon.svg` — Dark mark (`#0E0E0E` on transparent), no outline ring.
- ✅ `immediate-icon-invert.svg` — Same mark with the `#outline` ring path filled, used as the source for the raster favicons/app icons (rendered onto an opaque `#0E0E0E` plate — see "Raster favicons" below).

## Derived Assets

- ✅ `immediate-icon-favicon.svg` — Theme-aware browser favicon, hand-authored from `immediate-icon.svg` + `immediate-icon-invert.svg`'s outline. Swaps the outline ring's visibility via an internal `prefers-color-scheme` media query in its own `<style>` (Chromium/WebKit honour this *inside* an SVG favicon, even though neither honours the `media` attribute on the outer `<link rel="icon">`). Declared in `index.html`.
- ✅ `favicon.ico` (repo root `public/`, not this folder) — Real multi-size (16/32/48) ICO, generated from `immediate-icon-invert.svg` cropped to a square (top 675×675 of the 675×775 viewBox — the mark sits high, so the top crop is the one that fills edge-to-edge) and flattened onto an opaque `#0E0E0E` plate.
- ✅ `favicon-32.png`, `apple-touch-icon.png` (180×180), `icon-192.png`, `icon-512.png` — Same square-crop pipeline as `favicon.ico`, one PNG per target size. `icon-512.png` is also referenced twice in `manifest.webmanifest` (once plain, once with `"purpose": "maskable"` — the safe-zone margin already clears Android's maskable-icon crop).

### Unbound Merino Logos
- ⚠️ `unbound-logo-black.png`, `unbound-logo-white.png` — Wordmark PNGs, used on `LoginPage.tsx`. No SVG source has been supplied for these yet.

### Legacy PNGs — archive/legacy-src references ONLY
- 🗄️ `immediate-logo-black.png`, `immediate-logo-white.png` — Superseded by the SVGs above. Retained only because `archive/legacy-src-2026-04/` still references them; **do not wire these into new vNext components** — use the `.svg` equivalents.

## Usage

```tsx
{/* Theme-swapped wordmark, matches LoginPage.tsx */}
<img src="/images/brands/immediate-logo-black.svg" alt="Immediate" className="dark:hidden" />
<img src="/images/brands/immediate-logo-white.svg" alt="Immediate" className="hidden dark:block" />
```

## Asset Specifications

- **Format**: SVG (source of truth) for logos and icon marks; PNG/ICO only for browser-chrome targets that require a raster format (favicons, app icons, `apple-touch-icon`).
- **Background**: Transparent for the SVGs; the raster favicons/app icons are flattened onto an opaque `#0E0E0E` plate (browser chrome and OS icon grids don't reliably composite over transparency).
- **Byte-identity**: The SVGs above are byte-copied from the design vault and intentionally lack trailing newlines — do not run Prettier (or any formatter) over `public/images/brands/**`; see `.prettierignore` at the repo root.

## Adding/Updating Logos

1. Prefer SVG. Export at the vault's native viewBox — do not re-flatten to a fixed pixel size.
2. If a raster target is unavoidable (favicon/app-icon/social-share), regenerate the whole raster set together (`favicon.ico`, `favicon-32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`) from the same square-crop pipeline so they stay visually consistent.
3. Name files following the pattern: `immediate-[asset]-[variant].svg` (e.g. `immediate-logo-black.svg`).
4. Update this README when adding new assets.

## Notes

- Components switch logos based on the current theme (light/dark mode) via `dark:hidden` / `hidden dark:block` — never hardcode a single color variant if the container respects theme.
- Logos should maintain their original aspect ratio.
- Ensure sufficient contrast against both light and dark backgrounds.
