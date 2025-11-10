/**
 * Shot Builder Design Tokens Plugin
 *
 * This Tailwind CSS plugin provides semantic utility classes for typography,
 * spacing, and layout to ensure consistency across the application.
 *
 * Usage: Import and add to plugins array in tailwind.config.js
 *
 * @see src/styles/design-system.md for full documentation
 */

const plugin = require('tailwindcss/plugin');

module.exports = plugin(function({ addComponents, theme }) {
  /**
   * Typography Components
   * Semantic classes for consistent text styling
   */
  addComponents({
    // Page-level heading
    '.heading-page': {
      fontSize: theme('fontSize.2xl'),
      fontWeight: theme('fontWeight.bold'),
      color: theme('colors.neutral.900'),
      '@media (min-width: 768px)': {
        fontSize: theme('fontSize.3xl'),
      },
      '.dark &': {
        color: theme('colors.neutral.100'),
      },
    },

    // Section heading
    '.heading-section': {
      fontSize: theme('fontSize.xl'),
      fontWeight: theme('fontWeight.semibold'),
      color: theme('colors.neutral.900'),
      '.dark &': {
        color: theme('colors.neutral.100'),
      },
    },

    // Subsection heading
    '.heading-subsection': {
      fontSize: theme('fontSize.lg'),
      fontWeight: theme('fontWeight.semibold'),
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
   * Note: These are aliases for existing Tailwind utilities
   * but provided here for semantic clarity
   */
  addComponents({
    '.rounded-card': {
      borderRadius: theme('borderRadius.lg'), // 8px
    },
    '.rounded-btn': {
      borderRadius: theme('borderRadius.md'), // 6px
    },
    '.rounded-input': {
      borderRadius: theme('borderRadius.md'), // 6px
    },
  });
});
