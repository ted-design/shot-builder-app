// Scoped stylesheet for the Comprehensive Shot Report DOM renderer.
// All rules live under `.sb-report-root` and use `sb-`-prefixed classes so they
// never collide with the app's Tailwind layer. Brand law (docs/DESIGN.md):
// editorial restraint, ONE decisive red (the shot number, nothing else), Ivy
// Presto for the editorial moment, Neue Haas for body/labels/tabular, tiering by
// weight+size never faded gray, no drop shadows. Fonts are loaded app-wide via
// the Adobe typekit (gph3jzg) in index.html, so these families resolve.

export const REPORT_STYLES = `
.sb-report-root {
  /* Product table columns — SIZE + QTY are FIXED tracks (not auto) so columns
     align across every row AND the (sibling) header; an auto track is sized
     per-grid, which shifted the fr columns row-to-row. Defined here so both
     .sb-prod-list rows and .sb-prod-colhead inherit one source. */
  --sb-prod-cols: 14px minmax(0, 1.55fr) minmax(0, 1fr) 4.5rem 2.5rem;

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
  --sb-red: #EB1400;            /* Immediate Red — ONE job per surface */
  --sb-red-ink: oklch(0.55 0.20 28);

  /* Type scale (px) */
  --sb-t-3xs: 9px; --sb-t-2xs: 10px; --sb-t-xs: 12px; --sb-t-sm: 13px;
  --sb-t-base: 14px; --sb-t-lg: 16px; --sb-t-xl: 20px;

  /* Lookbook rhythm */
  --sb-plate-gap-col: clamp(28px, 3.4vw, 64px);
  --sb-plate-gap-row: clamp(40px, 5vw, 92px);

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
.sb-report-root *, .sb-report-root *::before, .sb-report-root *::after { box-sizing: border-box; }

/* shared atoms ---------------------------------------------------------- */
.sb-tabular, .sb-tnum { font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1; }
.sb-img-native { display: block; width: 100%; height: auto; object-fit: contain; }
.sb-muted { color: var(--sb-ink-3); font-style: italic; }
.sb-pending { color: var(--sb-ink-disabled); font-style: italic; }

.sb-no-image {
  display: flex; align-items: center; justify-content: center;
  background: repeating-linear-gradient(135deg, var(--sb-surface) 0 10px, var(--sb-surface-sub) 10px 20px);
  color: var(--sb-ink-3);
  font-family: var(--sb-font-ui); font-size: var(--sb-t-2xs);
  letter-spacing: 0.08em; text-transform: uppercase;
  border: 1px solid var(--sb-rule);
}

.sb-status-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
.sb-status--complete { background: oklch(0.62 0.13 150); }   /* green = Shot */
.sb-status--todo { background: var(--sb-ink-disabled); }     /* gray = To do */
.sb-status--progress { background: oklch(0.62 0.13 240); }   /* blue = In progress */
.sb-status--hold { background: oklch(0.74 0.14 75); }        /* amber = On hold */

.sb-badge-unresolved {
  font-family: var(--sb-font-ui); font-size: var(--sb-t-3xs); font-weight: 600;
  letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--sb-red-ink); border: 1px solid currentColor; border-radius: 2px;
  padding: 1px 4px; line-height: 1.2;
}

/* full-width fluid report frame ----------------------------------------- */
.sb-report {
  max-width: none; margin: 0;
  padding: 0 clamp(24px, 5vw, 96px) clamp(48px, 6vw, 120px);
}
.sb-empty {
  font-family: var(--sb-font-ui); color: var(--sb-ink-3); font-size: var(--sb-t-lg);
  padding: 48px 0;
}

/* masthead -------------------------------------------------------------- */
.sb-masthead-band {
  padding: clamp(40px, 5vw, 88px) 0 clamp(28px, 3vw, 44px);
  border-bottom: 1px solid var(--sb-rule-strong);
  margin-bottom: clamp(36px, 4.5vw, 80px);
}
.sb-masthead-eyebrow {
  margin: 0 0 clamp(16px, 1.6vw, 22px);
  display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap;
}
.sb-eyebrow {
  font-family: var(--sb-font-ui); font-weight: 600; font-size: var(--sb-t-2xs);
  letter-spacing: 0.10em; text-transform: uppercase; color: var(--sb-ink-2);
}
.sb-eyebrow.sb-lede { color: var(--sb-ink-3); }
.sb-masthead { font-family: var(--sb-font-display); font-weight: 700; letter-spacing: -0.01em; color: var(--sb-ink); }
.sb-masthead-title { font-size: clamp(40px, 6.4vw, 92px); line-height: 0.98; margin: 0; max-width: 18ch; }
.sb-masthead-meta {
  display: flex; flex-wrap: wrap; align-items: baseline;
  gap: clamp(20px, 3vw, 56px); margin-top: clamp(24px, 2.6vw, 40px);
}
.sb-meta-cell { display: flex; flex-direction: column; gap: 4px; }
.sb-meta-k {
  font-family: var(--sb-font-ui); font-size: var(--sb-t-2xs); font-weight: 600;
  letter-spacing: 0.10em; text-transform: uppercase; color: var(--sb-ink-3);
}
.sb-meta-v {
  font-family: var(--sb-font-ui); font-size: var(--sb-t-lg); font-weight: 500;
  color: var(--sb-ink); letter-spacing: -0.005em;
}
.sb-meta-v.sb-display { font-family: var(--sb-font-display); font-weight: 700; font-size: var(--sb-t-xl); }

/* group header ---------------------------------------------------------- */
.sb-group { margin-top: clamp(28px, 3.4vw, 56px); }
.sb-group:first-of-type { margin-top: 0; }
.sb-group-head {
  display: flex; align-items: flex-end; justify-content: space-between; gap: 24px;
  padding-bottom: clamp(14px, 1.4vw, 20px); margin-bottom: clamp(34px, 4vw, 68px);
  border-bottom: 1px solid var(--sb-rule);
}
.sb-group-name {
  font-family: var(--sb-font-display); font-weight: 700;
  font-size: clamp(26px, 3.4vw, 48px); line-height: 1; letter-spacing: -0.015em;
  color: var(--sb-ink); margin: 0;
}
.sb-group-count {
  font-family: var(--sb-font-ui); font-weight: 500; font-size: var(--sb-t-sm);
  color: var(--sb-ink-2); letter-spacing: 0.02em; white-space: nowrap; padding-bottom: 4px;
}

/* lookbook flow — true native-aspect masonry via CSS multi-column -------- */
.sb-plates { column-gap: var(--sb-plate-gap-col); column-width: 360px; }
@media (min-width: 1100px) { .sb-plates { column-count: 2; column-width: auto; } }
@media (min-width: 1680px) { .sb-plates { column-count: 3; column-width: auto; } }

.sb-plate {
  break-inside: avoid; -webkit-column-break-inside: avoid;
  margin: 0 0 var(--sb-plate-gap-row); display: inline-block; width: 100%;
  position: relative;
}

/* per-shot exclude toggle (screen only) */
.sb-exclude-toggle {
  position: absolute; top: 10px; right: 0; z-index: 3;
  appearance: none; cursor: pointer;
  font-family: var(--sb-font-ui); font-size: var(--sb-t-3xs); font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase; color: var(--sb-ink-2);
  background: var(--sb-paper); border: 1px solid var(--sb-rule-strong); border-radius: 999px;
  padding: 5px 11px; opacity: 0; transition: opacity 0.12s ease;
}
.sb-plate:hover .sb-exclude-toggle,
.sb-plate:focus-within .sb-exclude-toggle { opacity: 1; }
.sb-exclude-toggle[aria-pressed="true"] { opacity: 1; color: var(--sb-ink); border-color: var(--sb-ink); }
.sb-exclude-toggle:focus-visible { outline: 2px solid var(--sb-ink); outline-offset: 2px; opacity: 1; }

/* excluded — visible but struck + dimmed (reversible) */
.sb-excluded { opacity: 0.42; }
.sb-excluded .sb-shot-name { text-decoration: line-through; text-decoration-thickness: 1px; }
.sb-excluded .sb-exclude-toggle { opacity: 1; }

/* the photo figure ------------------------------------------------------ */
.sb-plate-figure { margin: 0; position: relative; }
.sb-plate-frame { position: relative; }
.sb-plate-frame::before {
  content: ""; display: block; border-top: 1px solid var(--sb-rule-strong); margin-bottom: 14px;
}
.sb-plate-img { background: var(--sb-surface); }
.sb-plate-noimg {
  aspect-ratio: 4 / 5; flex-direction: column; gap: 10px;
  text-align: center; line-height: 1.4;
}
.sb-ni-sub {
  font-family: var(--sb-font-body); text-transform: none; letter-spacing: 0;
  font-size: var(--sb-t-xs); color: var(--sb-ink-3); font-style: italic;
}

/* shot number overprint — red, the one job */
.sb-plate-no {
  position: absolute; top: 14px; left: 14px;
  font-family: var(--sb-font-display); font-weight: 700;
  font-size: clamp(28px, 2.6vw, 40px); line-height: 1; color: var(--sb-red);
  letter-spacing: -0.02em;
}
.sb-plate-no-inline {
  color: var(--sb-red); font-family: var(--sb-font-display); font-weight: 700;
  font-size: clamp(30px, 3vw, 44px); line-height: 1; letter-spacing: -0.02em;
}

/* caption block --------------------------------------------------------- */
.sb-plate-caption { padding-top: clamp(14px, 1.4vw, 20px); }
.sb-caption-topline { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 6px; }
.sb-shot-name { font-family: var(--sb-font-display); font-weight: 600; letter-spacing: -0.005em; line-height: 1.12; }
.sb-shot-title { font-size: clamp(19px, 1.55vw, 25px); line-height: 1.1; color: var(--sb-ink); margin: 0; }
.sb-colorway {
  font-family: var(--sb-font-body); font-style: italic; font-size: var(--sb-t-base);
  color: var(--sb-ink-2); margin: 2px 0 0;
}
.sb-caption-sub {
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--sb-rule);
}
.sb-status-chip {
  display: inline-flex; align-items: center; gap: 7px;
  font-family: var(--sb-font-ui); font-size: var(--sb-t-2xs); font-weight: 600;
  letter-spacing: 0.06em; text-transform: uppercase; color: var(--sb-ink-2);
}
.sb-talent-row { display: inline-flex; align-items: center; gap: 7px; }
.sb-talent-av {
  width: 18px; height: 18px; border-radius: 50%; object-fit: cover;
  background: var(--sb-surface-sub); border: 1px solid var(--sb-rule);
}
.sb-talent-name { font-family: var(--sb-font-ui); font-size: var(--sb-t-xs); color: var(--sb-ink-2); }
.sb-talent-name + .sb-talent-name::before { content: "· "; color: var(--sb-ink-3); }
.sb-talent-empty { font-family: var(--sb-font-ui); font-size: var(--sb-t-xs); color: var(--sb-ink-3); font-style: italic; }

.sb-shot-note {
  margin-top: 12px; font-family: var(--sb-font-body); font-size: var(--sb-t-sm);
  line-height: 1.45; color: var(--sb-ink-2); font-style: italic;
  padding-left: 12px; border-left: 1px solid var(--sb-rule-strong);
}

/* looks ----------------------------------------------------------------- */
.sb-looks { margin-top: clamp(16px, 1.6vw, 22px); display: flex; flex-direction: column; gap: 18px; }
.sb-look-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 8px; }
.sb-look-label {
  font-family: var(--sb-font-ui); font-size: var(--sb-t-2xs); font-weight: 700;
  letter-spacing: 0.12em; text-transform: uppercase; color: var(--sb-ink);
}
.sb-look--alt .sb-look-label { color: var(--sb-ink-2); }
.sb-look-rule { flex: 1; height: 0; border-top: 1px solid var(--sb-rule); align-self: center; }
.sb-look--alt {
  padding: 14px; margin-left: 2px; background: var(--sb-surface-sub); border: 1px solid var(--sb-rule);
}
.sb-alt-thumb-wrap { margin-bottom: 12px; }
.sb-alt-thumb { max-width: 168px; width: 55%; border: 1px solid var(--sb-rule); background: var(--sb-surface); }
.sb-alt-noimg { max-width: 168px; width: 55%; aspect-ratio: 4 / 5; font-size: var(--sb-t-3xs); }

/* product grid ---------------------------------------------------------- */
.sb-prod-list { display: flex; flex-direction: column; gap: 9px; }
.sb-prod {
  display: grid;
  grid-template-columns: var(--sb-prod-cols);
  align-items: baseline; column-gap: 14px; row-gap: 2px;
}
.sb-prod-hero-mark {
  width: 5px; height: 5px; border-radius: 50%; background: var(--sb-ink);
  align-self: center; margin-top: 1px; visibility: hidden;
}
.sb-prod--hero .sb-prod-hero-mark { visibility: visible; }
.sb-prod-fam {
  font-family: var(--sb-font-ui); font-size: var(--sb-t-sm); color: var(--sb-ink);
  line-height: 1.25; overflow-wrap: anywhere;
}
.sb-prod--hero .sb-prod-fam { font-weight: 600; }
.sb-prod-colour {
  font-family: var(--sb-font-body); font-size: var(--sb-t-xs); color: var(--sb-ink-2);
  line-height: 1.25; overflow-wrap: anywhere;
}
.sb-prod-style {
  font-family: var(--sb-font-ui); font-size: var(--sb-t-xs); color: var(--sb-ink-3);
  letter-spacing: 0.01em; white-space: nowrap;
}
.sb-prod-size {
  font-family: var(--sb-font-ui); font-size: var(--sb-t-xs); color: var(--sb-ink-2);
  text-align: right; white-space: nowrap; min-width: 4ch;
}
.sb-prod-qty {
  font-family: var(--sb-font-ui); font-size: var(--sb-t-xs); color: var(--sb-ink-3);
  text-align: right; white-space: nowrap; min-width: 3ch;
}
.sb-prod-meta { grid-column: 2 / 4; display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
.sb-prod-hero-tag {
  font-family: var(--sb-font-ui); font-size: var(--sb-t-3xs); font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase; color: var(--sb-ink-3);
}
.sb-prod-colhead {
  display: grid;
  grid-template-columns: var(--sb-prod-cols);
  column-gap: 14px; padding-bottom: 7px; margin-bottom: 9px; border-bottom: 1px solid var(--sb-rule);
}
.sb-prod-colhead span {
  font-family: var(--sb-font-ui); font-size: var(--sb-t-3xs); font-weight: 600;
  letter-spacing: 0.08em; text-transform: uppercase; color: var(--sb-ink-3);
}
.sb-prod-colhead .sb-ch-size, .sb-prod-colhead .sb-ch-qty { text-align: right; }

/* control bar (sticky, never prints) ------------------------------------ */
.sb-controlbar {
  position: sticky; top: 0; z-index: 50;
  display: flex; align-items: center; gap: clamp(16px, 2vw, 32px); flex-wrap: wrap;
  padding: 10px clamp(24px, 5vw, 96px);
  background: color-mix(in oklch, var(--sb-paper) 88%, transparent);
  backdrop-filter: saturate(1.4) blur(8px);
  border-bottom: 1px solid var(--sb-rule);
}
.sb-control-group { display: inline-flex; align-items: center; gap: 9px; }
.sb-control-label {
  font-family: var(--sb-font-ui); font-size: var(--sb-t-3xs); font-weight: 600;
  letter-spacing: 0.10em; text-transform: uppercase; color: var(--sb-ink-3);
}
.sb-seg {
  display: inline-flex; align-items: stretch;
  border: 1px solid var(--sb-rule-strong); border-radius: 999px; overflow: hidden;
  background: var(--sb-paper);
}
.sb-seg-btn {
  appearance: none; border: 0; background: transparent; cursor: pointer;
  font-family: var(--sb-font-ui); font-size: var(--sb-t-xs); font-weight: 600;
  letter-spacing: 0.04em; color: var(--sb-ink-2); padding: 7px 15px; line-height: 1;
}
.sb-seg-btn + .sb-seg-btn { border-left: 1px solid var(--sb-rule); }
.sb-seg-btn[aria-pressed="true"] { background: var(--sb-ink); color: var(--sb-paper); }
.sb-seg-btn:focus-visible { outline: 2px solid var(--sb-ink); outline-offset: -2px; }
.sb-export-btn {
  margin-left: auto; appearance: none; cursor: pointer;
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--sb-font-ui); font-size: var(--sb-t-xs); font-weight: 700;
  letter-spacing: 0.04em; color: var(--sb-paper); background: var(--sb-ink);
  border: 1px solid var(--sb-ink); border-radius: 999px; padding: 9px 20px; line-height: 1;
}
.sb-export-btn:hover:not(:disabled) { background: oklch(0.28 0.008 50); }
.sb-export-btn:disabled { cursor: default; opacity: 0.6; }
.sb-export-btn:focus-visible { outline: 2px solid var(--sb-ink); outline-offset: 2px; }
.sb-spin { animation: sb-spin 0.9s linear infinite; }
@keyframes sb-spin { to { transform: rotate(360deg); } }

/* paged (print preview) — hidden on screen until print-mode -------------- */
.sb-paged { display: none; }
.sb-sheet { display: none; }

/* PRINT / PAGED MODE — US Letter landscape, two plates per page ---------- */
.sb-print-mode { background: oklch(0.92 0.003 60); }
.sb-print-mode .sb-report { padding: clamp(16px, 3vw, 40px) 0; max-width: none; }
.sb-print-mode .sb-fluid,
.sb-print-mode .sb-masthead-band { display: none; }
.sb-print-mode .sb-paged { display: block; }
.sb-print-mode .sb-sheet {
  display: grid; grid-template-rows: auto 1fr auto;
  width: 11in; min-height: 8.5in; height: 8.5in;
  margin: 0 auto 0.34in; padding: 0.5in 0.6in 0.4in;
  background: var(--sb-paper); border: 1px solid var(--sb-rule);
  box-sizing: border-box; overflow: hidden;
}
.sb-sheet-head {
  display: flex; align-items: baseline; justify-content: space-between; gap: 18px;
  padding-bottom: 9px; border-bottom: 1px solid var(--sb-rule-strong);
}
.sb-sh-title { font-family: var(--sb-font-display); font-weight: 700; font-size: 15px; letter-spacing: -0.005em; color: var(--sb-ink); }
.sb-sh-proj { font-family: var(--sb-font-ui); font-size: 9px; color: var(--sb-ink-3); letter-spacing: 0.04em; }
.sb-sh-group {
  font-family: var(--sb-font-ui); font-size: 9px; font-weight: 600;
  letter-spacing: 0.12em; text-transform: uppercase; color: var(--sb-ink-2); white-space: nowrap;
}
.sb-sheet-body { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5in; align-items: start; min-height: 0; overflow: hidden; }
.sb-sheet-foot {
  display: flex; align-items: center; justify-content: space-between;
  padding-top: 8px; border-top: 1px solid var(--sb-rule);
  font-family: var(--sb-font-ui); font-size: 8px; color: var(--sb-ink-3);
  letter-spacing: 0.06em; text-transform: uppercase;
}
.sb-sheet .sb-plate { margin: 0; display: flex; flex-direction: column; break-inside: avoid; }
.sb-sheet .sb-plate-frame { display: flex; flex-direction: column; }
.sb-sheet .sb-plate-img { max-height: 4.4in; width: auto; max-width: 100%; object-fit: contain; align-self: flex-start; }
.sb-sheet .sb-plate-noimg { aspect-ratio: 4 / 5; max-height: 4.4in; }
.sb-sheet .sb-plate-no { font-size: 26px; }
.sb-sheet .sb-shot-title { font-size: 16px; }
.sb-sheet .sb-looks { gap: 12px; }
.sb-sheet .sb-look--alt { padding: 9px; }
.sb-sheet .sb-alt-thumb, .sb-sheet .sb-alt-noimg { max-width: 120px; }

@media print {
  @page { size: letter landscape; margin: 0; }
  .no-print { display: none !important; }
  .sb-report-root { background: #fff; }
  .sb-fluid, .sb-masthead-band { display: none !important; }
  .sb-report { padding: 0; }
  .sb-paged { display: block !important; }
  .sb-sheet {
    display: grid !important; grid-template-rows: auto 1fr auto;
    width: 11in; height: 8.5in; min-height: 8.5in;
    margin: 0; padding: 0.5in 0.6in 0.4in; border: 0; background: #fff;
    break-after: page; page-break-after: always; overflow: hidden;
  }
  .sb-sheet:last-child { break-after: auto; page-break-after: auto; }
}
`
