/** @type {import('tailwindcss').Config} */
// Delta Corporation brand tokens, sampled from delta.co.zw and the corporate logo:
//   navy  #123965 (wordmark / primary)   deep navy #082563 (site chrome)
//   gold  #C8B967 (triangle mark / rules) — accent only, never body text on white.
// Neutrals use Tailwind slate; status uses emerald / amber / red (with icon + label, never colour alone).
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        delta: {
          50: '#EEF3F9',
          100: '#DCE6F2',
          200: '#B7CAE2',
          300: '#86A5CB',
          500: '#2B5A90',
          600: '#1B4A7E',
          700: '#123965', // brand navy
          800: '#0D2D55',
          900: '#082563', // deep navy (site chrome)
          950: '#061A45',
        },
        gold: {
          50: '#FAF7EC',
          100: '#F2ECD2',
          300: '#DDD199',
          400: '#C8B967', // brand gold
          600: '#9C8C3E',
          700: '#7A6C2C', // gold-toned text that passes contrast on white
        },
        canvas: '#F8FAFC',
        line: '#E2E8F0',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        brand: ['"Source Serif 4"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.04)',
        pop: '0 12px 32px -8px rgba(15, 23, 42, 0.18)',
      },
    },
  },
  plugins: [],
};
