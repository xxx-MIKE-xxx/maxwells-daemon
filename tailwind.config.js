/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'demon-bg': '#1e1e1e',
        'demon-hud': '#252526',
        'demon-accent': '#007acc',
        'demon-green': '#4caf50',
        'demon-yellow': '#cca700',
        'demon-red': '#f44336',
      },
      fontFamily: {
        mono: ['Consolas', 'Monaco', 'Courier New', 'monospace'],
      }
    },
  },
  plugins: [],
}
