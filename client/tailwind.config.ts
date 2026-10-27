import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#08090C', // deep obsidian canvas
        surface: '#0E1015', // cards / bento panels
        'surface-raised': '#151821', // inputs / active items
        'surface-highlight': '#1E2330', // elevated borders & hovers
        thread: '#3395FF', // primary fintech accent (Razorpay electric cyan / blue)
        'thread-light': '#5CB3FF',
        'thread-dim': '#0C2340', // deep navy
        sage: '#10B981', // vibrant emerald (success / paid)
        rust: '#F43F5E', // vibrant rose (danger / rejected)
        amber: '#F59E0B', // warning / pending review
        dust: '#94A3B8', // muted secondary text (slate-400)
        'dust-dim': '#64748B', // subtle borders / icons (slate-500)
        linen: '#F8FAFC', // luminous primary text (slate-50)
        razorpay: {
          blue: '#0C2340',
          cyan: '#3395FF',
          dark: '#07162C',
        },
      },
      fontFamily: {
        display: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      backgroundImage: {
        'radial-glow': 'radial-gradient(ellipse at top, rgba(51, 149, 255, 0.15), transparent 70%)',
        'grid-pattern': 'radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.05) 1px, transparent 0)',
      },
    },
  },
  plugins: [],
} satisfies Config
