/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // BriteCo brand teal palette
        primary: {
          50: '#E1F7F6',
          100: '#C3EFED',
          200: '#87DFD9',
          300: '#31D7CA',  // bright teal
          400: '#00A3A4',
          500: '#008182',  // main teal
          600: '#006A6B',
          700: '#005354',
          800: '#003C3D',
          900: '#272D3F',  // dark navy
          950: '#1a1f2e',
        },
        // Brand color aliases
        navy: '#272D3F',
        slate: '#7DA3AF',
        teal: '#008182',
        'bright-teal': '#31D7CA',
        'orange-cta': '#FC883A',
        'dark-slate': '#466F88',
        'light-slate': '#A9C1CB',
      },
    },
  },
  plugins: [],
};
