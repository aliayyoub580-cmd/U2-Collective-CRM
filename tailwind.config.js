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
          DEFAULT: '#2563EB',
          dark: '#1E40AF',
          light: '#DBEAFE'
        },
        sidebar: '#0F172A',
        success: '#16A34A',
        warning: '#F59E0B',
        danger: '#DC2626',
        purple: '#7C3AED'
      },
      borderRadius: {
        'xl': '18px',
        '2xl': '22px'
      }
    },
  },
  plugins: [],
}
