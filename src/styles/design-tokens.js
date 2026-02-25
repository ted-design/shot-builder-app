/**
 * Shot Builder Design Tokens Plugin
 *
 * Direction A Editorial Typography — light-weight headings,
 * negative tracking, semantic label class.
 *
 * @see tokens.css for raw design tokens
 */

const plugin = require('tailwindcss/plugin');

module.exports = plugin(function({ addComponents, theme }) {
  /**
   * Typography Components
   * Semantic classes for consistent text styling
   */
  addComponents({
    // Page-level heading — light weight, editorial tracking
    '.heading-page': {
      fontSize: theme('fontSize.2xl'),
      fontWeight: '300',
      letterSpacing: '-0.02em',
      lineHeight: '1.2',
      color: theme('colors.neutral.900'),
      '@media (min-width: 768px)': {
        fontSize: theme('fontSize.3xl'),
      },
      '.dark &': {
        color: theme('colors.neutral.100'),
      },
    },

    // Section heading — semibold, subtle negative tracking
    '.heading-section': {
      fontSize: theme('fontSize.lg'),
      fontWeight: theme('fontWeight.semibold'),
      letterSpacing: '-0.01em',
      lineHeight: '1.3',
      color: theme('colors.neutral.900'),
      '.dark &': {
        color: theme('colors.neutral.100'),
      },
    },

    // Subsection heading
    '.heading-subsection': {
      fontSize: theme('fontSize.base'),
      fontWeight: theme('fontWeight.semibold'),
      letterSpacing: '-0.01em',
      lineHeight: '1.3',
      color: theme('colors.neutral.900'),
      '.dark &': {
        color: theme('colors.neutral.100'),
      },
    },

    // Regular body text
    '.body-text': {
      fontSize: theme('fontSize.sm'),
      color: theme('colors.neutral.700'),
      '.dark &': {
        color: theme('colors.neutral.300'),
      },
    },

    // Muted body text (de-emphasized)
    '.body-text-muted': {
      fontSize: theme('fontSize.sm'),
      color: theme('colors.neutral.600'),
      '.dark &': {
        color: theme('colors.neutral.400'),
      },
    },

    // Caption text (small, secondary)
    '.caption': {
      fontSize: theme('fontSize.xs'),
      color: theme('colors.neutral.600'),
      '.dark &': {
        color: theme('colors.neutral.400'),
      },
    },

    // Form label text
    '.label': {
      fontSize: theme('fontSize.sm'),
      fontWeight: theme('fontWeight.medium'),
      color: theme('colors.neutral.900'),
      '.dark &': {
        color: theme('colors.neutral.100'),
      },
    },

    // Meta label — uppercase, tracked (replaces repeated text-xs font-semibold uppercase tracking-widest pattern)
    '.label-meta': {
      fontSize: theme('fontSize.xs'),
      fontWeight: theme('fontWeight.semibold'),
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
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
