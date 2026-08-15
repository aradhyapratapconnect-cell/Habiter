/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0B1410',
        'bg-secondary': '#121F19',
        'bg-elevated': '#182B22',
        'border-subtle': '#24382E',
        'accent-primary': '#22C55E',
        'accent-primary-hover': '#16A34A',
        'accent-secondary': '#4ADE80',
        'status-partial': '#EAB308',
        'status-not-done': '#3A4A41',
        'status-skipped': '#EF4444',
        'text-primary': '#EAF5EE',
        'text-secondary': '#8FA89B',
        'text-disabled': '#54695E',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'display': ['28px', { lineHeight: '1.2', fontWeight: '700' }],
        'h1': ['20px', { lineHeight: '1.4', fontWeight: '600' }],
        'h2': ['16px', { lineHeight: '1.5', fontWeight: '600' }],
        'body': ['14px', { lineHeight: '1.5', fontWeight: '400' }],
        'small': ['12px', { lineHeight: '1.5', fontWeight: '400' }],
        'stat': ['32px', { lineHeight: '1.2', fontWeight: '700' }],
      },
      spacing: {
        'card-gap': '16px',
        'page-margin': '24px',
      },
      borderRadius: {
        'card': '12px',
        'modal': '16px',
        'button': '8px',
        'input': '8px',
      },
    },
  },
  plugins: [],
};
