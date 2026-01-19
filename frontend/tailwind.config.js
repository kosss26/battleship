/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0088cc',
        secondary: '#f5a623',
        success: '#27ae60',
        error: '#e74c3c',
        water: '#0099ff',
        ship: '#333333',
        hit: '#ff3333',
        miss: '#cccccc',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Monaco', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
