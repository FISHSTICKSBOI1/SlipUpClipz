/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#090b12',
          raised: '#10131c',
          overlay: '#161a27',
          border: '#2a3148',
        },
        ink: {
          soft: '#d5dced',
          muted: '#94a0b8',
          faint: '#647087',
        },
        accent: {
          DEFAULT: '#7c5cff',
          hover: '#9580ff',
          muted: '#5b3fd4',
          blue: '#3b82f6',
        },
        clip: {
          DEFAULT: '#10b981',
          hover: '#34d399',
          pressed: '#059669',
          muted: '#047857',
        },
      },
      fontFamily: {
        sans: [
          '"Segoe UI Variable"',
          '"Segoe UI"',
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif',
        ],
        mono: ['Consolas', '"Cascadia Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 0 rgba(255,255,255,0.05) inset, 0 12px 32px rgba(0,0,0,0.4)',
        soft: '0 8px 24px rgba(0,0,0,0.32)',
        glow: '0 0 32px rgba(124, 92, 255, 0.28)',
      },
      backgroundImage: {
        'app-glow':
          'radial-gradient(ellipse 70% 45% at 0% 0%, rgba(124,92,255,0.16), transparent 55%), radial-gradient(ellipse 50% 40% at 100% 0%, rgba(59,130,246,0.12), transparent 50%)',
      },
    },
  },
  plugins: [],
}
