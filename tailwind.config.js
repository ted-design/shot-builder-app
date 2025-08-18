/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary brand color palette
        primary: {
          DEFAULT: '#6366f1', // indigo-500
          dark: '#4f46e5',    // indigo-600
        },
        secondary: {
          DEFAULT: '#10b981', // emerald-500
          dark: '#059669',    // emerald-600
        },
      },
      fontFamily: {
        // Use a modern sans-serif stack; Inter if available, else fallback to system fonts
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Helvetica', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        'xl': '0.75rem',
      },
    },
  },
  plugins: [],
};
