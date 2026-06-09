/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        scarlet: '#BB0000',
        'scarlet-bright': '#E81010',
        flame: '#FF4B26',
        ink: '#0D0D0B',
        void: '#080606',
        cream: '#F5EFE4',
        'cream-dark': '#EDE6D8',
        'warm-gray': '#7A7166',
        amber: '#F59E0B',
      },
      keyframes: {
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        ticker2: {
          '0%': { transform: 'translateX(-50%)' },
          '100%': { transform: 'translateX(0)' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(0.8)' },
        },
        blob: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(40px, -60px) scale(1.12)' },
          '66%': { transform: 'translate(-30px, 30px) scale(0.9)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        livePulse: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.4', transform: 'scale(1.4)' },
        },
        feedLoop: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(-50%)' },
        },
        spinSlow: {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        ringPulse: {
          '0%': { transform: 'scale(0.9)', opacity: '0.5' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
      },
      animation: {
        ticker: 'ticker 30s linear infinite',
        'ticker-fast': 'ticker 22s linear infinite',
        ticker2: 'ticker2 28s linear infinite',
        'pulse-dot': 'pulseDot 2s infinite',
        blob: 'blob 10s ease-in-out infinite',
        'blob-delay-2': 'blob 12s ease-in-out 2s infinite',
        'blob-delay-4': 'blob 14s ease-in-out 4s infinite',
        float: 'float 4s ease-in-out infinite',
        'float-slow': 'float 6s ease-in-out 1s infinite',
        'float-slower': 'float 8s ease-in-out 2s infinite',
        shimmer: 'shimmer 3s linear infinite',
        'gradient-shift': 'gradientShift 8s ease infinite',
        'live-pulse': 'livePulse 1.5s ease-in-out infinite',
        'feed-loop': 'feedLoop 26s linear infinite',
        'spin-slow': 'spinSlow 30s linear infinite',
        'ring-pulse': 'ringPulse 2.4s ease-out infinite',
      },
    },
  },
  plugins: [],
}
