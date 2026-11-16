/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: '#F5F3ED',
          dark: '#202725',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          dark: '#2A3230',
          alt: '#EFEEE8',
          'alt-dark': '#323B38',
        },
        ink: {
          DEFAULT: '#30383B',
          dark: '#F0F2EF',
          muted: '#545E62',
          'muted-dark': '#BCC5C1',
        },
        rule: {
          DEFAULT: '#E3E0D8',
          dark: '#46514D',
        },
        signal: {
          DEFAULT: '#B83838',
          hover: '#A32F2F',
          light: '#FBEFED',
          'light-dark': '#402626',
        },
        action: {
          DEFAULT: '#263F4A',
          hover: '#1D333C',
          light: '#EAF0F1',
          'light-dark': '#263B42',
        },
        ok: {
          DEFAULT: '#3F7D58',
          light: '#EDF4EF',
          'light-dark': '#263D2E',
        },
        warn: {
          DEFAULT: '#D69E36',
          text: '#805812',
          'text-dark': '#E7C57D',
          light: '#FBF4E7',
          'light-dark': '#423821',
        },
        info: {
          DEFAULT: '#477C9B',
          'text-dark': '#A6C8DA',
          light: '#EDF3F7',
          'light-dark': '#263943',
        },
        sim: {
          DEFAULT: '#5B4B8A',
          light: '#F2EFF8',
          'light-dark': '#251E38',
        },
      },
      fontFamily: {
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
        sans: ['"Noto Sans"', 'Inter', 'Lato', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"IBM Plex Mono"', '"JetBrains Mono"', 'Consolas', 'monospace'],
      },
      borderRadius: {
        control: '6px',
        panel: '10px',
      },
      boxShadow: {
        overlay: '0 4px 20px rgba(28, 26, 23, 0.08)',
        modal: '0 10px 30px rgba(28, 26, 23, 0.16)',
      },
    },
  },
  plugins: [],
}
