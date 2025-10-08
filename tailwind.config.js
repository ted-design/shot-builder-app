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
    },
  },
  plugins: [],
};
