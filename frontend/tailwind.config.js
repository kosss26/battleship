/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#030712', 900: '#060d1d', 850: '#0a1428', 800: '#0e1a33', 700: '#16254a' },
        sea: { 300: '#7dd3fc', 400: '#38bdf8', 500: '#0ea5e9' },
        neon: '#22d3ee',
        gold: '#fbbf24',
        gem: '#c084fc',
      },
      fontFamily: {
        display: ['Unbounded', 'system-ui', 'sans-serif'],
        sans: ['Manrope', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 24px -4px rgba(34,211,238,0.55)',
        gold: '0 0 24px -6px rgba(251,191,36,0.6)',
        card: '0 10px 30px -12px rgba(0,0,0,0.6)',
      },
      keyframes: {
        shimmer: { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(100%)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        sweep: { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
        wave: { '0%': { backgroundPosition: '0 0' }, '100%': { backgroundPosition: '200px 100px' } },
      },
      animation: {
        shimmer: 'shimmer 2.4s infinite',
        float: 'float 3s ease-in-out infinite',
        sweep: 'sweep 2.4s linear infinite',
        wave: 'wave 18s linear infinite',
      },
    },
  },
  plugins: [],
}
