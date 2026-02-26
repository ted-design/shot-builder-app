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
    '.label-meta': {
      fontSize: 'var(--text-xs)',
      fontWeight: 'var(--weight-semibold)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-wider)',
      color: 'var(--color-text-subtle)',
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
