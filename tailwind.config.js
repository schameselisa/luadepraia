/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Nude / beige — backgrounds, soft surfaces
        sand: {
          50: '#FBF7F4',
          100: '#F7F1EC',
          200: '#EFE5DC',
          300: '#E2D2C4',
        },
        // Nude accent — delicate details, support elements
        nude: {
          50: '#F8F0EB',
          100: '#F0E1D6',
          200: '#E2C9B5',
          300: '#D4B79E',
          400: '#C49E83',
          500: '#bc967a',
          600: '#A67E65',
          700: '#8C6A52',
        },
        // Light blue — informative accents, details
        sky: {
          50: '#EDF6FA',
          100: '#D6EBF3',
          200: '#AED8E8',
          300: '#7AC2D8',
          400: '#52AEC5',
          500: '#379cba',
          600: '#2D87A8',
          700: '#247092',
        },
        // Aqua / green — success, availability
        aqua: {
          50: '#E6F7F5',
          100: '#CCEFEC',
          200: '#99DFDA',
          300: '#66CFCB',
          400: '#33BFBA',
          500: '#00a896',
          600: '#009180',
          700: '#007668',
        },
        // Navy — primary brand color, titles, buttons, important text
        navy: {
          50: '#EDF0F4',
          100: '#D1DAE4',
          200: '#A3B5C9',
          300: '#7590AE',
          400: '#476B93',
          500: '#2E5278',
          600: '#274669',
          700: '#1f3a58',
          800: '#1A3149',
          900: '#152939',
        },
        // Plum — semantic alias mapping to navy (primary text/headings)
        plum: {
          700: '#2E5278',
          800: '#274669',
          900: '#1f3a58',
        },
        // Blush — semantic alias for brand accent (light blue)
        blush: {
          50: '#EDF6FA',
          100: '#D6EBF3',
          200: '#AED8E8',
          300: '#7AC2D8',
          400: '#379cba',
          500: '#379cba',
          600: '#2D87A8',
          700: '#247092',
        },
        // Gray — secondary text
        gray: {
          400: '#9A9A9A',
          500: '#7a7a7a',
          600: '#6B6B6B',
        },
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        soft: '0 6px 24px -10px rgba(31, 58, 88, 0.15)',
        card: '0 8px 30px -12px rgba(31, 58, 88, 0.18)',
      },
    },
  },
  plugins: [],
};
