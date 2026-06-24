// Scoped stylesheet for the Talent report DOM renderer (R4 PR2). All rules live
// under `.sb-tr-root` with `sb-tr-`/`sb-`-prefixed classes so they never collide
// with the app's Tailwind layer. Brand law (docs/DESIGN.md): editorial restraint,
// ONE decisive red (the HOLD flag, nothing else), Ivy Presto for the editorial
// moment, Neue Haas for body/labels/tabular, tiering by weight+size never faded
// gray, no drop shadows. Fonts load app-wide via typekit gph3jzg. Ported faithfully
// from comp-talent.html.

export const TALENT_STYLES = `
.sb-tr-root {
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
  --sb-red: #EB1400;            /* Immediate Red — ONE job per surface (HOLD flag) */

  /* Type scale (px) */
  --sb-t-3xs: 9px; --sb-t-2xs: 10px; --sb-t-xs: 12px; --sb-t-sm: 13px;
  --sb-t-base: 14px; --sb-t-lg: 16px; --sb-t-xl: 20px; --sb-t-2xl: 26px; --sb-t-3xl: 34px;

  /* Card grid density — wide call-sheet card (headshot col + info col). */
  --sb-card-min: 380px;
  --sb-card-gap: clamp(20px, 2.2vw, 32px);

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
.sb-tr-root *, .sb-tr-root *::before, .sb-tr-root *::after { box-sizing: border-box; }

/* shared atoms ---------------------------------------------------------- */
.sb-tr-root .sb-tabular, .sb-tr-root .sb-tnum {
  font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1;
}
.sb-tr-root .sb-pending { color: var(--sb-ink-disabled); font-style: italic; }
.sb-tr-root .sb-status-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; flex: 0 0 auto; }
.sb-tr-root .sb-status--complete { background: oklch(0.62 0.13 150); }   /* green = Shot */
.sb-tr-root .sb-status--todo { background: var(--sb-ink-disabled); }     /* gray = To do */
.sb-tr-root .sb-status--progress { background: oklch(0.62 0.13 240); }   /* blue = In progress */
.sb-tr-root .sb-status--hold { background: oklch(0.74 0.14 75); }        /* amber = On hold */

/* control bar (sticky, never prints) ------------------------------------ */
.sb-tr-controlbar {
  position: sticky; top: 0; z-index: 50;
  display: flex; align-items: center; gap: clamp(16px, 2vw, 32px); flex-wrap: wrap;
  padding: 10px clamp(24px, 5vw, 96px);
  background: color-mix(in oklch, var(--sb-paper) 88%, transparent);
  backdrop-filter: saturate(1.4) blur(8px);
  border-bottom: 1px solid var(--sb-rule);
}
.sb-tr-control-group { display: inline-flex; align-items: center; gap: 9px; }
.sb-tr-control-label {
  font-family: var(--sb-font-ui); font-size: var(--sb-t-3xs); font-weight: 600;
  letter-spacing: 0.10em; text-transform: uppercase; color: var(--sb-ink-3);
}
.sb-tr-seg {
  display: inline-flex; align-items: stretch;
  border: 1px solid var(--sb-rule-strong); border-radius: 999px; overflow: hidden;
  background: var(--sb-paper);
}
.sb-tr-seg-btn {
  appearance: none; border: 0; background: transparent; cursor: pointer;
  font-family: var(--sb-font-ui); font-size: var(--sb-t-xs); font-weight: 600;
  letter-spacing: 0.04em; color: var(--sb-ink-2); padding: 7px 15px; line-height: 1;
}
.sb-tr-seg-btn + .sb-tr-seg-btn { border-left: 1px solid var(--sb-rule); }
.sb-tr-seg-btn[aria-pressed="true"] { background: var(--sb-ink); color: var(--sb-paper); }
.sb-tr-seg-btn:focus-visible { outline: 2px solid var(--sb-ink); outline-offset: -2px; }
.sb-tr-export-btn {
  margin-left: auto; appearance: none; cursor: pointer;
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--sb-font-ui); font-size: var(--sb-t-xs); font-weight: 700;
  letter-spacing: 0.04em; color: var(--sb-paper); background: var(--sb-ink);
  border: 1px solid var(--sb-ink); border-radius: 999px; padding: 9px 20px; line-height: 1;
}
.sb-tr-export-btn:hover:not(:disabled) { background: oklch(0.28 0.008 50); }
.sb-tr-export-btn:disabled { cursor: default; opacity: 0.6; }
.sb-tr-export-btn:focus-visible { outline: 2px solid var(--sb-ink); outline-offset: 2px; }
.sb-tr-spin { animation: sb-tr-spin 0.9s linear infinite; }
@keyframes sb-tr-spin { to { transform: rotate(360deg); } }

/* fluid report frame ---------------------------------------------------- */
.sb-tr-report {
  max-width: none; margin: 0;
  padding: clamp(24px, 3vw, 40px) clamp(24px, 5vw, 96px) clamp(48px, 6vw, 120px);
}
.sb-tr-empty {
  font-family: var(--sb-font-ui); color: var(--sb-ink-3); font-size: var(--sb-t-lg);
  padding: 48px 0;
}

/* masthead -------------------------------------------------------------- */
.sb-tr-masthead-band {
  padding: clamp(40px, 5vw, 80px) 0 clamp(24px, 3vw, 40px);
  border-bottom: 1px solid var(--sb-rule-strong); margin-bottom: clamp(32px, 4vw, 56px);
}
.sb-tr-eyebrow-row {
  margin: 0 0 clamp(14px, 1.4vw, 20px);
  display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap;
}
.sb-tr-eyebrow {
  font-family: var(--sb-font-ui); font-weight: 600; font-size: var(--sb-t-2xs);
  letter-spacing: 0.10em; text-transform: uppercase; color: var(--sb-ink-2);
}
.sb-tr-lede { color: var(--sb-ink-2); }
.sb-tr-masthead-title {
  font-family: var(--sb-font-display); font-weight: 700; letter-spacing: -0.01em;
  font-size: clamp(38px, 5.6vw, 78px); line-height: 1.0; margin: 0; max-width: 18ch; color: var(--sb-ink);
}
.sb-tr-masthead-meta {
  display: flex; flex-wrap: wrap; align-items: baseline;
  gap: clamp(20px, 3vw, 52px); margin-top: clamp(22px, 2.4vw, 36px);
}
.sb-tr-meta-cell { display: flex; flex-direction: column; gap: 4px; }
.sb-tr-meta-k {
  font-family: var(--sb-font-ui); font-size: var(--sb-t-2xs); font-weight: 600;
  letter-spacing: 0.10em; text-transform: uppercase; color: var(--sb-ink-3);
}
.sb-tr-meta-v {
  font-family: var(--sb-font-display); font-size: var(--sb-t-2xl); line-height: 1;
  color: var(--sb-ink); font-variant-numeric: tabular-nums;
}

/* group header ---------------------------------------------------------- */
.sb-tr-group { margin-top: clamp(40px, 4.5vw, 72px); }
.sb-tr-group:first-of-type { margin-top: 0; }
.sb-tr-group-head {
  display: flex; align-items: baseline; gap: 16px;
  border-bottom: 1px solid var(--sb-rule); padding-bottom: 12px; margin-bottom: clamp(20px, 2.4vw, 32px);
}
.sb-tr-group-name {
  font-family: var(--sb-font-display); font-weight: 600;
  font-size: clamp(24px, 2.8vw, 38px); line-height: 1; color: var(--sb-ink);
}
.sb-tr-group-count {
  font-family: var(--sb-font-ui); font-size: var(--sb-t-sm);
  letter-spacing: 0.04em; color: var(--sb-ink-3);
}

/* talent grid ----------------------------------------------------------- */
.sb-tr-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--sb-card-min), 1fr));
  gap: var(--sb-card-gap);
}
.sb-tr-card {
  display: grid; grid-template-columns: 132px 1fr; gap: 18px;
  break-inside: avoid; border: 1px solid var(--sb-rule); border-radius: 2px;
  background: var(--sb-surface); padding: 16px; position: relative;
}

/* headshot column ------------------------------------------------------- */
.sb-tr-headshot { width: 132px; }
.sb-tr-headshot-frame {
  width: 100%; background: var(--sb-surface-sub);
  border: 1px solid var(--sb-rule); border-radius: 2px; overflow: hidden;
}
.sb-tr-headshot-frame img { display: block; width: 100%; height: auto; object-fit: contain; }
.sb-tr-headshot-initials {
  aspect-ratio: 4 / 5; display: flex; align-items: center; justify-content: center;
  font-family: var(--sb-font-display); font-size: var(--sb-t-3xl); color: var(--sb-ink-3);
}
.sb-tr-appearances {
  margin-top: 8px; font-family: var(--sb-font-ui); font-size: var(--sb-t-2xs);
  letter-spacing: 0.06em; text-transform: uppercase; color: var(--sb-ink-3); text-align: center;
}

/* info column ----------------------------------------------------------- */
.sb-tr-info { min-width: 0; }
.sb-tr-name-row { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 4px; }
.sb-tr-name {
  font-family: var(--sb-font-display); font-weight: 600; font-size: var(--sb-t-xl);
  line-height: 1.08; letter-spacing: -0.005em; color: var(--sb-ink);
}
/* HOLD — the ONE red on this surface */
.sb-tr-hold-flag {
  display: inline-flex; align-items: center; gap: 4px;
  font-family: var(--sb-font-ui); font-size: var(--sb-t-3xs); font-weight: 700;
  letter-spacing: 0.10em; text-transform: uppercase; color: var(--sb-red);
}
.sb-tr-hold-flag::before { content: ""; width: 8px; height: 8px; background: var(--sb-red); border-radius: 1px; }

.sb-tr-badges { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
.sb-tr-badge-gender {
  font-family: var(--sb-font-ui); font-size: var(--sb-t-2xs); font-weight: 600;
  letter-spacing: 0.06em; text-transform: uppercase; color: var(--sb-ink-2);
  border: 1px solid var(--sb-rule-strong); border-radius: 2px; padding: 1px 6px;
}
.sb-tr-agency { font-family: var(--sb-font-ui); font-size: var(--sb-t-sm); color: var(--sb-ink-2); }

.sb-tr-contact {
  display: flex; flex-wrap: wrap; gap: 3px 12px; font-size: var(--sb-t-sm); color: var(--sb-ink);
  margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--sb-rule);
}
.sb-tr-c-item { display: inline-flex; align-items: baseline; gap: 5px; min-width: 0; max-width: 100%; }
.sb-tr-c-k {
  flex: 0 0 auto;
  font-family: var(--sb-font-ui); font-size: var(--sb-t-3xs); font-weight: 600;
  letter-spacing: 0.08em; text-transform: uppercase; color: var(--sb-ink-3);
}
/* URLs/emails are long unbreakable strings — break them so they stay in the card. */
.sb-tr-c-v { min-width: 0; overflow-wrap: anywhere; }

.sb-tr-measures {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 14px; margin-bottom: 12px;
}
.sb-tr-measure { display: flex; flex-direction: column; gap: 1px; }
.sb-tr-m-k {
  font-family: var(--sb-font-ui); font-size: var(--sb-t-3xs); font-weight: 600;
  letter-spacing: 0.06em; text-transform: uppercase; color: var(--sb-ink-3);
}
.sb-tr-m-v { font-size: var(--sb-t-base); color: var(--sb-ink); font-variant-numeric: tabular-nums; }

.sb-tr-shots-k {
  font-family: var(--sb-font-ui); font-size: var(--sb-t-2xs); font-weight: 600;
  letter-spacing: 0.08em; text-transform: uppercase; color: var(--sb-ink-3); margin-bottom: 6px;
}
.sb-tr-shots-list { display: flex; flex-direction: column; gap: 4px; }
.sb-tr-shot-line { display: flex; align-items: baseline; gap: 8px; font-size: var(--sb-t-sm); }
.sb-tr-s-no {
  flex: 0 0 auto; min-width: 22px; font-variant-numeric: tabular-nums; color: var(--sb-ink);
  display: inline-flex; align-items: center; gap: 5px;
}
.sb-tr-s-title { color: var(--sb-ink-2); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sb-tr-s-looks { flex: 0 0 auto; color: var(--sb-ink-3); font-size: var(--sb-t-xs); }

/* per-card exclude toggle (screen only) */
.sb-tr-exclude-toggle {
  position: absolute; top: 8px; right: 8px; z-index: 3;
  appearance: none; cursor: pointer;
  font-family: var(--sb-font-ui); font-size: var(--sb-t-3xs); font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase; color: var(--sb-ink-2);
  background: var(--sb-paper); border: 1px solid var(--sb-rule-strong); border-radius: 999px;
  padding: 5px 11px; opacity: 0; transition: opacity 0.12s ease;
}
.sb-tr-card:hover .sb-tr-exclude-toggle,
.sb-tr-card:focus-within .sb-tr-exclude-toggle { opacity: 1; }
.sb-tr-exclude-toggle[aria-pressed="true"] { opacity: 1; color: var(--sb-ink); border-color: var(--sb-ink); }
.sb-tr-exclude-toggle:focus-visible { outline: 2px solid var(--sb-ink); outline-offset: 2px; opacity: 1; }

/* excluded — visible but struck + dimmed (reversible) */
.sb-tr-excluded { opacity: 0.42; }
.sb-tr-excluded .sb-tr-name { text-decoration: line-through; text-decoration-thickness: 1px; }
.sb-tr-excluded .sb-tr-exclude-toggle { opacity: 1; }

/* paged (print preview) — hidden on screen until print-mode -------------- */
.sb-tr-paged { display: none; }
.sb-tr-sheet { display: none; }

.sb-tr-print-mode { background: oklch(0.92 0.003 60); }
.sb-tr-print-mode .sb-tr-fluid,
.sb-tr-print-mode .sb-tr-masthead-band { display: none; }
.sb-tr-print-mode .sb-tr-paged { display: block; }
.sb-tr-print-mode .sb-tr-sheet {
  display: grid; grid-template-rows: auto 1fr auto;
  width: 11in; min-height: 8.5in;
  margin: 0 auto 0.34in; padding: 0.5in 0.6in 0.4in;
  background: var(--sb-paper); border: 1px solid var(--sb-rule);
  box-sizing: border-box;
}
.sb-tr-sheet-head {
  display: flex; align-items: baseline; justify-content: space-between; gap: 18px;
  padding-bottom: 9px; border-bottom: 1px solid var(--sb-rule-strong);
}
.sb-tr-sh-title { font-family: var(--sb-font-display); font-weight: 700; font-size: 15px; letter-spacing: -0.005em; color: var(--sb-ink); }
.sb-tr-sh-proj { font-family: var(--sb-font-ui); font-size: 9px; color: var(--sb-ink-3); letter-spacing: 0.04em; }
.sb-tr-sh-group {
  font-family: var(--sb-font-ui); font-size: 9px; font-weight: 600;
  letter-spacing: 0.12em; text-transform: uppercase; color: var(--sb-ink-2); white-space: nowrap;
}
/* print card grid — 2-up landscape so a wide call-sheet card never straddles a break */
.sb-tr-sheet-body {
  display: grid; grid-template-columns: repeat(var(--sb-tr-print-cols, 2), 1fr);
  gap: 0.3in 0.34in; align-items: start; min-height: 0;
}
.sb-tr-sheet-foot {
  display: flex; align-items: center; justify-content: space-between;
  padding-top: 8px; border-top: 1px solid var(--sb-rule);
  font-family: var(--sb-font-ui); font-size: 8px; color: var(--sb-ink-3);
  letter-spacing: 0.06em; text-transform: uppercase;
}
.sb-tr-sheet .sb-tr-card { break-inside: avoid; page-break-inside: avoid; }
.sb-tr-sheet .sb-tr-name { font-size: var(--sb-t-lg); }
.sb-tr-sheet .sb-tr-headshot-frame img { max-height: 2in; width: auto; max-width: 100%; object-fit: contain; }

@media print {
  @page { size: letter landscape; margin: 0; }
  .no-print { display: none !important; }
  .sb-tr-root { background: #fff; }
  .sb-tr-fluid, .sb-tr-masthead-band { display: none !important; }
  .sb-tr-report { padding: 0; }
  .sb-tr-paged { display: block !important; }
  .sb-tr-sheet {
    display: grid !important; grid-template-rows: auto 1fr auto;
    width: 11in; min-height: 8.5in;
    margin: 0; padding: 0.5in 0.6in 0.4in; border: 0; background: #fff;
    break-after: page; page-break-after: always;
  }
  .sb-tr-sheet:last-child { break-after: auto; page-break-after: auto; }
  .sb-tr-card { break-inside: avoid; page-break-inside: avoid; }
}
`
