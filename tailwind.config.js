// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      // Extend the default colour palette with custom primary and secondary colours.
      colors: {
        primary: {
          DEFAULT: "#6366f1", // indigo-500
          dark: "#4f46e5",    // indigo-600
        },
        secondary: {
          DEFAULT: "#10b981", // emerald-500
          dark: "#059669",    // emerald-600
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
      },
    },
  },
  plugins: [],
};
