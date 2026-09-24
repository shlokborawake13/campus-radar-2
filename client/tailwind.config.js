/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#10b981',
          hover: '#059669',
          dark: '#006c49',
          container: '#10b981',
          'on-container': '#00422b',
          fixed: '#6ffbbe',
          'fixed-dim': '#4edea3',
          'on-fixed': '#002113'
        },
        secondary: {
          DEFAULT: '#6366f1',
          dark: '#4648d4',
          container: '#6063ee',
          'on-container': '#fffbff',
          fixed: '#e1e0ff',
          'fixed-dim': '#c0c1ff'
        },
        tertiary: {
          DEFAULT: '#ef4444',
          dark: '#b91a24',
          container: '#ff7a73',
          'on-container': '#79000e'
        },
        surface: {
          DEFAULT: '#faf8ff',
          dim: '#d2d9f4',
          bright: '#faf8ff',
          lowest: '#ffffff',
          low: '#f2f3ff',
          container: '#eaedff',
          high: '#e2e7ff',
          highest: '#dae2fd',
          variant: '#dae2fd'
        },
        slate: {
          headline: '#0f172a',
          body: '#334155',
          meta: '#64748b',
          placeholder: '#94a3b8',
          border: '#e2e8f0',
          card: '#f8fafc',
          subtle: '#f1f5f9'
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'emerald-fab': '0 8px 20px -4px rgba(16, 185, 129, 0.35)',
        'indigo-soft': '0 8px 20px -4px rgba(99, 102, 241, 0.25)',
        'soft-card': '0 2px 10px rgba(0, 0, 0, 0.03)',
        'modal-up': '0 -10px 30px rgba(15, 23, 42, 0.1)',
      }
    },
  },
  plugins: [],
}
