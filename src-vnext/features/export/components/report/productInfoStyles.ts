// Scoped stylesheet for the Product Info report DOM renderer (R4 PR1). All rules
// live under `.sb-pir-root` with `sb-pir-`/`sb-`-prefixed classes so they never
// collide with the app's Tailwind layer. Brand law (docs/DESIGN.md): editorial
// restraint, ONE decisive red (the HERO mark, nothing else), Ivy Presto for the
// editorial moment, Neue Haas for body/labels/tabular, tiering by weight+size
// never faded gray, no drop shadows. Fonts load app-wide via typekit gph3jzg.
// Ported faithfully from comp-product-info.html.

export const PRODUCT_INFO_STYLES = `
.sb-pir-root {
  /* Type families (app loads typekit gph3jzg) */
  --sb-font-display: "ivypresto-headline", Georgia, serif;
  --sb-font-body: "neue-haas-grotesk-text", "Helvetica Neue", Arial, sans-serif;
  --sb-font-ui: "neue-haas-grotesk-display", "Helvetica Neue", Arial, sans-serif;

  /* Color — tinted neutrals toward the brand hue (OKLCH), never pure #000/#fff */
  --sb-paper: oklch(0.994 0.001 30);
  --sb-surface: oklch(0.985 0.002 30);
  --sb-surface-sub: oklch(0.965 0.003 40);
  --sb-ink: oklch(0.205 0.008 50);
  --sb-ink-2: oklch(0.44 0.010 55);
  --sb-ink-3: oklch(0.58 0.010 55);
  --sb-ink-disabled: oklch(0.72 0.008 55);
  --sb-rule: oklch(0.90 0.004 50);
  --sb-rule-strong: oklch(0.83 0.005 50);
  --sb-red: #EB1400;            /* Immediate Red — ONE job per surface (HERO mark) */

  /* Type scale (px) */
  --sb-t-3xs: 9px; --sb-t-2xs: 10px; --sb-t-xs: 12px; --sb-t-sm: 13px;
  --sb-t-base: 14px; --sb-t-lg: 16px; --sb-t-xl: 20px; --sb-t-2xl: 26px;

  /* Card grid density — driven by the S/M/L image-size toggle (column count
     only; images fill the card width natively, never letterboxed). */
  --sb-card-min: 232px;
  --sb-card-gap: clamp(20px, 2.2vw, 36px);

  box-sizing: border-box;
  font-family: var(--sb-font-body);
  font-size: var(--sb-t-base);
  line-height: 1.5;
  color: var(--sb-ink);
  background: var(--sb-surface-sub);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  min-height: 100%;
}
.sb-pir-root *, .sb-pir-root *::before, .sb-pir-root *::after { box-sizing: border-box; }

/* S / M / L image-size — pure column density (no max-height letterbox) */
.sb-pir-root[data-size="s"] { --sb-card-min: 184px; }
.sb-pir-root[data-size="m"] { --sb-card-min: 232px; }
.sb-pir-root[data-size="l"] { --sb-card-min: 300px; }

/* shared atoms ---------------------------------------------------------- */
.sb-pir-root .sb-tabular, .sb-pir-root .sb-tnum {
  font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1;
}
.sb-pir-root .sb-img-native { display: block; width: 100%; height: auto; object-fit: contain; }
.sb-pir-root .sb-pending { color: var(--sb-ink-disabled); font-style: italic; }
.sb-pir-root .sb-status-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; flex: 0 0 auto; }
.sb-pir-root .sb-status--complete { background: oklch(0.62 0.13 150); }   /* green = Shot */
.sb-pir-root .sb-status--todo { background: var(--sb-ink-disabled); }     /* gray = To do */
.sb-pir-root .sb-status--progress { background: oklch(0.62 0.13 240); }   /* blue = In progress */
.sb-pir-root .sb-status--hold { background: oklch(0.74 0.14 75); }        /* amber = On hold */

.sb-pir-noimg {
  display: flex; align-items: center; justify-content: center;
  background: repeating-linear-gradient(135deg, var(--sb-surface) 0 10px, var(--sb-surface-sub) 10px 20px);
  color: var(--sb-ink-3);
  font-family: var(--sb-font-ui); font-size: var(--sb-t-2xs);
  letter-spacing: 0.08em; text-transform: uppercase;
  border: 1px solid var(--sb-rule);
  width: 100%; aspect-ratio: 4 / 5;
}

/* control bar (sticky, never prints) ------------------------------------ */
.sb-pir-controlbar {
  position: sticky; top: 0; z-index: 50;
  display: flex; align-items: center; gap: clamp(16px, 2vw, 32px); flex-wrap: wrap;
  padding: 10px clamp(24px, 5vw, 96px);
  background: color-mix(in oklch, var(--sb-paper) 88%, transparent);
  backdrop-filter: saturate(1.4) blur(8px);
  border-bottom: 1px solid var(--sb-rule);
}
.sb-pir-control-group { display: inline-flex; align-items: center; gap: 9px; }
.sb-pir-control-label {
  font-family: var(--sb-font-ui); font-size: var(--sb-t-3xs); font-weight: 600;
  letter-spacing: 0.10em; text-transform: uppercase; color: var(--sb-ink-3);
}
.sb-pir-seg {
  display: inline-flex; align-items: stretch;
  border: 1px solid var(--sb-rule-strong); border-radius: 999px; overflow: hidden;
  background: var(--sb-paper);
}
.sb-pir-seg-btn {
  appearance: none; border: 0; background: transparent; cursor: pointer;
  font-family: var(--sb-font-ui); font-size: var(--sb-t-xs); font-weight: 600;
  letter-spacing: 0.04em; color: var(--sb-ink-2); padding: 7px 15px; line-height: 1;
}
.sb-pir-seg-btn + .sb-pir-seg-btn { border-left: 1px solid var(--sb-rule); }
.sb-pir-seg-btn[aria-pressed="true"] { background: var(--sb-ink); color: var(--sb-paper); }
.sb-pir-seg-btn:focus-visible { outline: 2px solid var(--sb-ink); outline-offset: -2px; }
.sb-pir-export-btn {
  margin-left: auto; appearance: none; cursor: pointer;
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--sb-font-ui); font-size: var(--sb-t-xs); font-weight: 700;
  letter-spacing: 0.04em; color: var(--sb-paper); background: var(--sb-ink);
  border: 1px solid var(--sb-ink); border-radius: 999px; padding: 9px 20px; line-height: 1;
}
.sb-pir-export-btn:hover:not(:disabled) { background: oklch(0.28 0.008 50); }
.sb-pir-export-btn:disabled { cursor: default; opacity: 0.6; }
.sb-pir-export-btn:focus-visible { outline: 2px solid var(--sb-ink); outline-offset: 2px; }
.sb-pir-spin { animation: sb-pir-spin 0.9s linear infinite; }
@keyframes sb-pir-spin { to { transform: rotate(360deg); } }

/* fluid report frame ---------------------------------------------------- */
.sb-pir-report {
  max-width: none; margin: 0;
  padding: clamp(24px, 3vw, 40px) clamp(24px, 5vw, 96px) clamp(48px, 6vw, 120px);
}
.sb-pir-empty {
  font-family: var(--sb-font-ui); color: var(--sb-ink-3); font-size: var(--sb-t-lg);
  padding: 48px 0;
}

/* masthead -------------------------------------------------------------- */
.sb-pir-masthead-band {
  padding: clamp(40px, 5vw, 80px) 0 clamp(24px, 3vw, 40px);
  border-bottom: 1px solid var(--sb-rule-strong); margin-bottom: clamp(32px, 4vw, 64px);
}
.sb-pir-eyebrow-row {
  margin: 0 0 clamp(14px, 1.4vw, 20px);
  display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap;
}
.sb-pir-eyebrow {
  font-family: var(--sb-font-ui); font-weight: 600; font-size: var(--sb-t-2xs);
  letter-spacing: 0.10em; text-transform: uppercase; color: var(--sb-ink-2);
}
.sb-pir-lede { color: var(--sb-ink-3); }
.sb-pir-masthead-title {
  font-family: var(--sb-font-display); font-weight: 700; letter-spacing: -0.01em;
  font-size: clamp(38px, 5.6vw, 78px); line-height: 1.0; margin: 0; max-width: 18ch; color: var(--sb-ink);
}
.sb-pir-masthead-meta {
  display: flex; flex-wrap: wrap; align-items: baseline;
  gap: clamp(20px, 3vw, 52px); margin-top: clamp(22px, 2.4vw, 36px);
}
.sb-pir-meta-cell { display: flex; flex-direction: column; gap: 4px; }
.sb-pir-meta-k {
  font-family: var(--sb-font-ui); font-size: var(--sb-t-2xs); font-weight: 600;
  letter-spacing: 0.10em; text-transform: uppercase; color: var(--sb-ink-3);
}
.sb-pir-meta-v {
  font-family: var(--sb-font-display); font-size: var(--sb-t-2xl); line-height: 1;
  color: var(--sb-ink); font-variant-numeric: tabular-nums;
}

/* group header ---------------------------------------------------------- */
.sb-pir-group { margin-top: clamp(40px, 4.5vw, 72px); }
.sb-pir-group:first-of-type { margin-top: 0; }
.sb-pir-group-head {
  display: flex; align-items: baseline; gap: 16px;
  border-bottom: 1px solid var(--sb-rule); padding-bottom: 12px; margin-bottom: clamp(20px, 2.4vw, 32px);
}
.sb-pir-group-name {
  font-family: var(--sb-font-display); font-weight: 600;
  font-size: clamp(24px, 2.8vw, 38px); line-height: 1; color: var(--sb-ink);
}
.sb-pir-group-count {
  font-family: var(--sb-font-ui); font-size: var(--sb-t-sm);
  letter-spacing: 0.04em; color: var(--sb-ink-3);
}

/* product grid ---------------------------------------------------------- */
.sb-pir-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--sb-card-min), 1fr));
  gap: var(--sb-card-gap);
}
.sb-pir-card { display: flex; flex-direction: column; break-inside: avoid; position: relative; }
.sb-pir-card-frame {
  position: relative; width: 100%; background: var(--sb-surface);
  border: 1px solid var(--sb-rule); border-radius: 2px; overflow: hidden;
}
.sb-pir-card-frame img { display: block; width: 100%; height: auto; }

.sb-pir-card-body { padding: 14px 2px 0; }
.sb-pir-card-name {
  font-family: var(--sb-font-display); font-weight: 600; font-size: var(--sb-t-lg);
  line-height: 1.14; letter-spacing: -0.005em; color: var(--sb-ink); margin: 0 0 6px;
}
.sb-pir-card-ident {
  display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;
  font-family: var(--sb-font-ui); font-size: var(--sb-t-xs); color: var(--sb-ink-2); margin-bottom: 10px;
}
.sb-pir-style-no { font-variant-numeric: tabular-nums; letter-spacing: 0.02em; }
.sb-pir-dot-sep { color: var(--sb-ink-disabled); }

/* HERO — the ONE red on this surface */
.sb-pir-hero-tag {
  display: inline-flex; align-items: center; gap: 4px;
  font-family: var(--sb-font-ui); font-size: var(--sb-t-3xs); font-weight: 700;
  letter-spacing: 0.10em; text-transform: uppercase; color: var(--sb-red);
}
.sb-pir-hero-tag::before { content: ""; width: 8px; height: 8px; background: var(--sb-red); border-radius: 50%; }

.sb-pir-row { display: flex; gap: 8px; align-items: baseline; margin-bottom: 7px; font-size: var(--sb-t-sm); }
.sb-pir-row .sb-pir-k {
  flex: 0 0 auto; font-family: var(--sb-font-ui); font-size: var(--sb-t-2xs); font-weight: 600;
  letter-spacing: 0.08em; text-transform: uppercase; color: var(--sb-ink-3); min-width: 58px;
}
.sb-pir-row .sb-pir-v { color: var(--sb-ink); }
.sb-pir-chips { display: flex; flex-wrap: wrap; gap: 5px; }
.sb-pir-chip {
  font-size: var(--sb-t-xs); padding: 2px 8px; border: 1px solid var(--sb-rule-strong);
  border-radius: 999px; color: var(--sb-ink-2); white-space: nowrap;
}

.sb-pir-appears { margin-top: 4px; padding-top: 10px; border-top: 1px solid var(--sb-rule); }
.sb-pir-appears .sb-pir-k {
  display: block; font-family: var(--sb-font-ui); font-size: var(--sb-t-2xs); font-weight: 600;
  letter-spacing: 0.08em; text-transform: uppercase; color: var(--sb-ink-3); margin-bottom: 5px;
}
.sb-pir-appears-list { display: flex; flex-wrap: wrap; gap: 4px 10px; }
.sb-pir-appears-item {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: var(--sb-t-sm); color: var(--sb-ink); font-variant-numeric: tabular-nums;
}
.sb-pir-appears-item .sb-pir-look { color: var(--sb-ink-3); font-size: var(--sb-t-xs); }

/* per-card exclude toggle (screen only) */
.sb-pir-exclude-toggle {
  position: absolute; top: 8px; right: 8px; z-index: 3;
  appearance: none; cursor: pointer;
  font-family: var(--sb-font-ui); font-size: var(--sb-t-3xs); font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase; color: var(--sb-ink-2);
  background: var(--sb-paper); border: 1px solid var(--sb-rule-strong); border-radius: 999px;
  padding: 5px 11px; opacity: 0; transition: opacity 0.12s ease;
}
.sb-pir-card:hover .sb-pir-exclude-toggle,
.sb-pir-card:focus-within .sb-pir-exclude-toggle { opacity: 1; }
.sb-pir-exclude-toggle[aria-pressed="true"] { opacity: 1; color: var(--sb-ink); border-color: var(--sb-ink); }
.sb-pir-exclude-toggle:focus-visible { outline: 2px solid var(--sb-ink); outline-offset: 2px; opacity: 1; }

/* excluded — visible but struck + dimmed (reversible) */
.sb-pir-excluded { opacity: 0.42; }
.sb-pir-excluded .sb-pir-card-name { text-decoration: line-through; text-decoration-thickness: 1px; }
.sb-pir-excluded .sb-pir-exclude-toggle { opacity: 1; }

/* paged (print preview) — hidden on screen until print-mode -------------- */
.sb-pir-paged { display: none; }
.sb-pir-sheet { display: none; }

.sb-pir-print-mode { background: oklch(0.92 0.003 60); }
.sb-pir-print-mode .sb-pir-fluid,
.sb-pir-print-mode .sb-pir-masthead-band { display: none; }
.sb-pir-print-mode .sb-pir-paged { display: block; }
.sb-pir-print-mode .sb-pir-sheet {
  display: grid; grid-template-rows: auto 1fr auto;
  width: 11in; min-height: 8.5in;
  margin: 0 auto 0.34in; padding: 0.5in 0.6in 0.4in;
  background: var(--sb-paper); border: 1px solid var(--sb-rule);
  box-sizing: border-box;
}
.sb-pir-sheet-head {
  display: flex; align-items: baseline; justify-content: space-between; gap: 18px;
  padding-bottom: 9px; border-bottom: 1px solid var(--sb-rule-strong);
}
.sb-pir-sh-title { font-family: var(--sb-font-display); font-weight: 700; font-size: 15px; letter-spacing: -0.005em; color: var(--sb-ink); }
.sb-pir-sh-proj { font-family: var(--sb-font-ui); font-size: 9px; color: var(--sb-ink-3); letter-spacing: 0.04em; }
.sb-pir-sh-group {
  font-family: var(--sb-font-ui); font-size: 9px; font-weight: 600;
  letter-spacing: 0.12em; text-transform: uppercase; color: var(--sb-ink-2); white-space: nowrap;
}
/* print card grid — denser fixed column count so a card never straddles a break */
.sb-pir-sheet-body {
  display: grid; grid-template-columns: repeat(var(--sb-pir-print-cols, 4), 1fr);
  gap: 0.3in 0.34in; align-items: start; min-height: 0;
}
.sb-pir-sheet-foot {
  display: flex; align-items: center; justify-content: space-between;
  padding-top: 8px; border-top: 1px solid var(--sb-rule);
  font-family: var(--sb-font-ui); font-size: 8px; color: var(--sb-ink-3);
  letter-spacing: 0.06em; text-transform: uppercase;
}
.sb-pir-sheet .sb-pir-card { break-inside: avoid; page-break-inside: avoid; }
.sb-pir-sheet .sb-pir-card-name { font-size: var(--sb-t-sm); }
.sb-pir-sheet .sb-pir-card-frame img { max-height: 2.3in; width: auto; max-width: 100%; object-fit: contain; }

@media print {
  @page { size: letter landscape; margin: 0; }
  .no-print { display: none !important; }
  .sb-pir-root { background: #fff; }
  .sb-pir-fluid, .sb-pir-masthead-band { display: none !important; }
  .sb-pir-report { padding: 0; }
  .sb-pir-paged { display: block !important; }
  .sb-pir-sheet {
    display: grid !important; grid-template-rows: auto 1fr auto;
    width: 11in; min-height: 8.5in;
    margin: 0; padding: 0.5in 0.6in 0.4in; border: 0; background: #fff;
    break-after: page; page-break-after: always;
  }
  .sb-pir-sheet:last-child { break-after: auto; page-break-after: auto; }
  .sb-pir-card { break-inside: avoid; page-break-inside: avoid; }
}
`
