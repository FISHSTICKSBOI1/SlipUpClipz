import path from 'node:path'
import { fileURLToPath } from 'node:url'

const websiteRoot = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('tailwindcss').Config} */
export default {
  // Paths must be absolute: Vite runs from the monorepo root, and Tailwind
  // resolves relative content globs from process.cwd(), not this config file.
  content: [
    path.join(websiteRoot, 'index.html'),
    path.join(websiteRoot, 'src', '**', '*.{js,ts,jsx,tsx}'),
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#090b12',
          raised: '#10131c',
          panel: '#161a27',
          border: '#2a3148',
        },
        glow: {
          purple: '#7c5cff',
          blue: '#3b82f6',
          magenta: '#e879f9',
          cyan: '#22d3ee',
        },
      },
      fontFamily: {
        display: ['"Syne"', 'system-ui', 'sans-serif'],
        sans: ['"Manrope"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 40px rgba(124, 92, 255, 0.25)',
      },
      backgroundImage: {
        'hero-grid':
          'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(124, 92, 255, 0.28), transparent 55%), radial-gradient(ellipse 50% 40% at 90% 20%, rgba(232, 121, 249, 0.16), transparent 50%), radial-gradient(ellipse 40% 30% at 10% 40%, rgba(59, 130, 246, 0.18), transparent 45%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s ease-out both',
        'pulse-soft': 'pulseSoft 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
