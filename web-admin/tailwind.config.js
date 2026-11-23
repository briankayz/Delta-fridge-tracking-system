/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Delta Brand & Design System Tokens from CLAUDE.md
        primaryNavy: "#315B7C",
        darkNavy: "#003366",
        accentGold: "#D4AF37",
        accentCyan: "#0087DC",
        bgDark: "#0F172A",
        bgDarkCard: "#1E293B",
        bgLight: "#F8FAFC",
        bgLightCard: "#FFFFFF",
        statusSafe: "#10B981",
        statusWarning: "#F59E0B",
        statusCritical: "#EF4444",

        // Stitch Admin Palette Tokens
        primary: "#154363",
        "primary-container": "#315b7c",
        "on-primary": "#ffffff",
        "on-primary-container": "#a9d2f9",
        secondary: "#0062a1",
        "secondary-container": "#47a8ff",
        "on-secondary": "#ffffff",
        "on-secondary-container": "#003c65",
        "secondary-fixed": "#d0e4ff",
        tertiary: "#735c00",
        "tertiary-fixed": "#ffe088",
        "on-tertiary-fixed": "#241a00",
        surface: "#faf8ff",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f2f3ff",
        "surface-container": "#eaedff",
        "surface-container-high": "#e2e7ff",
        "surface-container-highest": "#dae2fd",
        "on-surface": "#131b2e",
        "on-surface-variant": "#42474d",
        background: "#faf8ff",
        error: "#ba1a1a",
        "error-container": "#ffdad6",
        "on-error": "#ffffff",
        "on-error-container": "#93000a",
        outline: "#72787e",
        "outline-variant": "#c2c7ce",
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px',
      },
    },
  },
  plugins: [],
}

