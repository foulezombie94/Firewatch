/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        fire: {
          50: '#fff1f2',
          100: '#ffe4e6',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
          900: '#881337',
          glow: '#ff3300',
        }
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s infinite ease-in-out',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '1', filter: 'drop-shadow(0 0 8px rgba(255, 51, 0, 0.8))' },
          '50%': { opacity: '0.6', filter: 'drop-shadow(0 0 2px rgba(255, 51, 0, 0.3))' },
        }
      }
    },
  },
  plugins: [],
}
