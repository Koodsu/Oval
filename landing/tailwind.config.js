/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Bebas Neue', 'Impact', 'sans-serif'],
        sans: ['DM Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        scarlet: '#BB0000',
        'scarlet-bright': '#D90000',
        ink: '#0D0D0B',
        cream: '#F5EFE4',
        'cream-dark': '#EDE6D8',
        'warm-gray': '#7A7166',
      },
      keyframes: {
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(0.8)' },
        },
      },
      animation: {
        ticker: 'ticker 30s linear infinite',
        'pulse-dot': 'pulseDot 2s infinite',
      },
    },
  },
  plugins: [],
}
