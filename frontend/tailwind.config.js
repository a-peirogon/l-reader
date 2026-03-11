/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      colors: {
        surface: {
          DEFAULT: '#0a0a0a',
          raised: '#111111',
          border: '#1f1f1f',
          border2: '#2a2a2a',
        },
        text: {
          primary: '#f0f0f0',
          secondary: '#888888',
          muted: '#555555',
          dim: '#2e2e2e',
        },
        accent: {
          green: '#5fba75',
          red: '#c96b6b',
        },
      },
      borderRadius: { card: '16px' },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        modalIn: {
          from: { opacity: '0', transform: 'scale(0.96) translateY(8px)' },
          to: { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        bounce3: {
          '0%, 60%, 100%': { opacity: '0.3', transform: 'translateY(0)' },
          '30%': { opacity: '1', transform: 'translateY(-3px)' },
        },
      },
      animation: {
        fadeUp: 'fadeUp 0.16s ease-out',
        modalIn: 'modalIn 0.16s ease-out',
        bounce3: 'bounce3 1.1s infinite',
      },
    },
  },
  plugins: [],
}
