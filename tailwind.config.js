// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // Enable class-based dark mode
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./src-vnext/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      // Direction A: Near-Black Editorial — zinc neutrals, near-black primary, red accent
      colors: {
        // Brand colors
        'immediate-red': '#E31E24',
        'immediate-red-dark': '#c91920',

        // Sidebar theme tokens (dark sidebar even in light mode)
        sidebar: '#09090b',           // zinc-950
        'sidebar-border': '#27272a',  // zinc-800
        'sidebar-hover': '#27272a',   // zinc-800
        'sidebar-active': '#3f3f46',  // zinc-700

        // Primary action (near-black)
        primary: {
          DEFAULT: "#18181b", // zinc-900
          dark: "#27272a",    // zinc-800 (hover)
          foreground: "#ffffff",
        },
        // Secondary action
        secondary: {
          DEFAULT: "#10b981", // emerald-500
          dark: "#059669",    // emerald-600
          foreground: "#ffffff",
        },
        // Semantic colors for consistent UI feedback
        warning: {
          DEFAULT: "#f59e0b", // amber-500
        },
        danger: {
          DEFAULT: "#ef4444", // red-500
        },
        info: {
          DEFAULT: "#3b82f6", // blue-500
        },

        // Neutral scale (zinc)
        neutral: {
          50:  '#fafafa',   // zinc-50
          100: '#f4f4f5',   // zinc-100
          200: '#e4e4e7',   // zinc-200
          300: '#d4d4d8',   // zinc-300
          400: '#a1a1aa',   // zinc-400
          500: '#71717a',   // zinc-500
          600: '#52525b',   // zinc-600
          700: '#3f3f46',   // zinc-700
          800: '#27272a',   // zinc-800
          900: '#18181b',   // zinc-900
          950: '#09090b',   // zinc-950
        },

        // Semantic surface colors
        surface: {
          DEFAULT: '#ffffff',
          dark: '#27272a', // neutral-800 (zinc)
        },
        muted: {
          DEFAULT: '#f4f4f5',   // neutral-100 (zinc)
          dark: '#3f3f46',      // neutral-700 (zinc)
          foreground: 'var(--color-text-muted)',
        },

        // shadcn/ui semantic tokens (mapped to tokens.css)
        background: 'var(--color-surface)',
        foreground: 'var(--color-text)',
        card: {
          DEFAULT: 'var(--color-surface)',
          foreground: 'var(--color-text)',
        },
        popover: {
          DEFAULT: 'var(--color-surface)',
          foreground: 'var(--color-text)',
        },
        accent: {
          DEFAULT: 'var(--color-surface-subtle)',
          foreground: 'var(--color-text)',
        },
        border: 'var(--color-border)',
        input: 'var(--color-border)',
        ring: 'var(--color-primary)',
        destructive: {
          DEFAULT: 'var(--color-error)',
          foreground: '#ffffff',
        },
      },
      // Editorial typography — tighter heading leading, micro sizes
      fontSize: {
        // Micro sizes (replace arbitrary text-[9px], text-[10px], text-[11px])
        '3xs': ['0.5625rem', { lineHeight: '0.75rem' }],   // 9px
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],   // 10px
        'xxs': ['0.6875rem', { lineHeight: '1rem' }],      // 11px

        // Heading overrides — tighter leading than Tailwind defaults
        '2xl': ['1.5rem', { lineHeight: '1.875rem' }],     // 24px / 30px (1.25)
        '3xl': ['1.75rem', { lineHeight: '2.125rem' }],    // 28px / 34px (1.21)
        '4xl': ['2rem', { lineHeight: '2.375rem' }],       // 32px / 38px (1.19)
      },
      // Editorial letter-spacing — subtler than Tailwind defaults
      letterSpacing: {
        tighter: '-0.02em',   // Headings (editorial negative tracking)
        tight: '-0.01em',     // Sub-headings
      },
      // Design system border-radius values for consistency
      borderRadius: {
        card: "8px",    // Use for all cards (reduced from 14px for less toy-like appearance)
        button: "6px",  // Use for all buttons
        badge: "10px",  // Use for status badges (pill shape)
      },
      // Define a modern sans-serif font stack. Inter is loaded via CDN in index.html.
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica',
          'Arial',
          'Noto Sans',
          'Apple Color Emoji',
          'Segoe UI Emoji',
          'Segoe UI Symbol',
        ],
      },
      // Customize the container to center content and provide responsive padding.
      container: {
        center: true,
        padding: {
          DEFAULT: '1rem',
          sm: '1.25rem',
          lg: '2rem',
          xl: '2.5rem',
        },
        screens: {
          '2xl': '1400px',
        },
      },
      // Z-index scale for proper layering
      zIndex: {
        '60': '60',
        '100': '100',
      },
      // Animation keyframes and utilities for smooth transitions
      keyframes: {
        // Fade animations
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-out': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        // Slide animations
        'slide-in-from-top': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'slide-in-from-bottom': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'slide-in-from-right': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-in-from-left': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-out-to-right': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'fade-in-down': {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-out-to-top': {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(-100%)' },
        },
        // Scale animations
        'zoom-in': {
          '0%': { transform: 'scale(0.95)' },
          '100%': { transform: 'scale(1)' },
        },
        'zoom-out': {
          '0%': { transform: 'scale(1)' },
          '100%': { transform: 'scale(0.95)' },
        },
        // Shimmer animation for loading skeletons
        'shimmer': {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
      animation: {
        // Entrance animations
        'fade-in': 'fade-in 0.2s ease-out',
        'fade-out': 'fade-out 0.15s ease-in',
        'slide-in-from-top': 'slide-in-from-top 0.3s ease-out',
        'slide-in-from-bottom': 'slide-in-from-bottom 0.3s ease-out',
        'slide-in-from-right': 'slide-in-from-right 0.2s ease-out',
        'slide-in-from-left': 'slide-in-from-left 0.2s ease-out',
        'slide-out-to-right': 'slide-out-to-right 0.15s ease-in',
        'slide-out-to-top': 'slide-out-to-top 0.2s ease-in',
        'zoom-in': 'zoom-in 0.2s ease-out',
        'zoom-out': 'zoom-out 0.2s ease-in',
        'shimmer': 'shimmer 2s ease-in-out infinite',
        'fade-in-down': 'fade-in-down 0.2s ease-out',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('./src/styles/design-tokens'),
  ],
};
