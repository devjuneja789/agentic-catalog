import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#14141F', // base background
        surface: '#1C1C2A', // panels/cards
        'surface-raised': '#262639', // inputs, hover states
        thread: '#D4A24E', // primary accent — brass/amber, the "stitching" color
        'thread-dim': '#8A6B34',
        sage: '#7FA687', // success / in-stock / paid
        rust: '#C1655A', // danger / error / rejected
        dust: '#9B96A8', // muted text, labels
        linen: '#EDEAE3', // primary text
      },
      fontFamily: {
        display: ['Fraunces', 'ui-serif', 'serif'],
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config
