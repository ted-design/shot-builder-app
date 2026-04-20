/**
 * Shot Builder Design Tokens Plugin
 *
 * Direction A Editorial Typography — light-weight headings,
 * negative tracking, semantic label class.
 *
 * All colors reference CSS custom properties from tokens.css
 * so dark mode overrides work automatically.
 *
 * @see tokens.css for raw design tokens
 */

const plugin = require('tailwindcss/plugin');

module.exports = plugin(function({ addComponents, theme }) {
  /**
   * Typography Components
   * Semantic classes for consistent text styling.
   * Colors use CSS vars (not Tailwind theme) for dark mode compatibility.
   */
  addComponents({
    // Page-level heading — light weight, editorial tracking
    // 24px mobile / 28px desktop, font-light 300, -0.02em
    '.heading-page': {
      fontSize: 'var(--text-2xl)',
      fontWeight: 'var(--weight-light)',
      letterSpacing: 'var(--tracking-heading)',
      lineHeight: 'var(--leading-heading)',
      color: 'var(--color-text)',
      '@media (min-width: 768px)': {
        fontSize: 'var(--text-3xl)',
      },
    },

    // Section heading — semibold, subtle negative tracking
    // 16px, font-semibold 600, -0.01em
    '.heading-section': {
      fontSize: 'var(--text-lg)',
      fontWeight: 'var(--weight-semibold)',
      letterSpacing: 'var(--tracking-subheading)',
      lineHeight: 'var(--leading-subheading)',
      color: 'var(--color-text)',
    },

    // Subsection heading
    // 14px, font-semibold 600, -0.01em
    '.heading-subsection': {
      fontSize: 'var(--text-base)',
      fontWeight: 'var(--weight-semibold)',
      letterSpacing: 'var(--tracking-subheading)',
      lineHeight: 'var(--leading-subheading)',
      color: 'var(--color-text)',
    },

    // Regular body text
    '.body-text': {
      fontSize: 'var(--text-sm)',
      color: 'var(--color-text-secondary)',
    },

    // Muted body text (de-emphasized)
    '.body-text-muted': {
      fontSize: 'var(--text-sm)',
      color: 'var(--color-text-muted)',
    },

    // Caption text (small, secondary)
    '.caption': {
      fontSize: 'var(--text-xs)',
      color: 'var(--color-text-muted)',
    },

    // Form label text
    '.label': {
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--weight-medium)',
      color: 'var(--color-text)',
    },

    // Meta label — uppercase, tracked
    // 12px, font-semibold 600, uppercase, 0.05em tracking
    // Replaces repeated text-xs font-semibold uppercase tracking-widest pattern
    //
    // WCAG AA compliance (a11y H-2): color is --color-text-secondary (#52525b,
    // zinc-600), not --color-text-subtle (#a1a1aa, zinc-400). At 12px semibold,
    // `.label-meta` does NOT qualify as WCAG "large text" and must clear 4.5:1
    // on every surface it renders on. `.label-meta` appears on both white
    // (--color-surface) AND subtle (--color-surface-subtle / #f4f4f5) surfaces
    // (e.g. table headers), so the foreground must clear 4.5:1 against the
    // darker of the two — #f4f4f5:
    //   - zinc-400 #a1a1aa on #f4f4f5: 2.33:1  (FAIL — original H-2 bug)
    //   - zinc-500 #71717a on #f4f4f5: 4.40:1  (FAIL — still just below AA)
    //   - zinc-600 #52525b on #f4f4f5: 7.03:1  (PASS AA, clears AAA)
    // --color-text-subtle remains available for truly decorative uses (icons,
    // large headings ≥18.66px bold / ≥24px regular) where 3:1 is sufficient.
    '.label-meta': {
      fontSize: 'var(--text-xs)',
      fontWeight: 'var(--weight-semibold)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-wider)',
      color: 'var(--color-text-secondary)',
    },
  });

  /**
   * Spacing & Layout Components
   * Semantic classes for consistent spacing patterns
   */
  addComponents({
    // Page wrapper vertical spacing
    '.page-wrapper': {
      '& > * + *': {
        marginTop: theme('spacing.6'),
      },
    },

    // Section gap (flexbox/grid)
    '.section-gap': {
      gap: theme('spacing.6'),
    },

    // Standard card padding
    '.card-padding': {
      padding: theme('spacing.6'),
    },

    // Toolbar padding (horizontal + vertical)
    '.toolbar-padding': {
      paddingLeft: theme('spacing.6'),
      paddingRight: theme('spacing.6'),
      paddingTop: theme('spacing.3'),
      paddingBottom: theme('spacing.3'),
    },

    // Content area padding
    '.content-padding': {
      paddingLeft: theme('spacing.6'),
      paddingRight: theme('spacing.6'),
      paddingTop: theme('spacing.4'),
      paddingBottom: theme('spacing.4'),
    },
  });

  /**
   * Border Radius Tokens
   */
  addComponents({
    '.rounded-card': {
      borderRadius: theme('borderRadius.lg'),
    },
    '.rounded-btn': {
      borderRadius: theme('borderRadius.md'),
    },
    '.rounded-input': {
      borderRadius: theme('borderRadius.md'),
    },
  });
});
