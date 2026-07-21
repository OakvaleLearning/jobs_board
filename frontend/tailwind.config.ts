import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Semantic role aliases. Primary = brand emerald, secondary = terracotta,
        // accent = gold. These mirror the scales below so `bg-primary-500`,
        // `text-accent-600`, etc. resolve to the same hex as their source palette.
        primary: {
          DEFAULT: '#059669',
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#059669',
          600: '#047857',
          700: '#065F46',
          800: '#064E3B',
        },
        secondary: {
          DEFAULT: '#B5532A',
          50: '#FBEFE9',
          100: '#F4D6C5',
          200: '#ECB69E',
          400: '#D17B4F',
          500: '#B5532A',
          600: '#974321',
          700: '#75331A',
        },
        accent: {
          DEFAULT: '#D9AE2E',
          50: '#FDF9EB',
          100: '#F9EEC8',
          200: '#F1DC8F',
          300: '#E8C755',
          400: '#D9AE2E',
          500: '#B8901C',
          600: '#927012',
          700: '#6E540E',
        },
        brand: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#059669',
          600: '#047857',
          700: '#065F46',
          800: '#064E3B',
        },
        cream: {
          50: '#FDFBF7',
          100: '#FAF6F0',
          200: '#F2EBDF',
          300: '#E6DAC6',
        },
        ink: {
          DEFAULT: '#1C1A17',
          800: '#2A2622',
          600: '#4A4540',
          500: '#6B645C',
        },
        terracotta: {
          50: '#FBEFE9',
          100: '#F4D6C5',
          200: '#ECB69E',
          400: '#D17B4F',
          500: '#B5532A',
          600: '#974321',
          700: '#75331A',
        },
        // Muted emerald-family greens so sage surfaces harmonise with the
        // emerald brand while keeping deep, readable 600 text tones.
        sage: {
          50: '#EBF7F1',
          100: '#D2EEE0',
          200: '#A9DEC5',
          300: '#79C7A4',
          400: '#47AB80',
          500: '#2E8F67',
          600: '#1F6F4F',
          700: '#175540',
        },
        // Gold accent — always paired with dark ink text, never white-on-gold.
        amber: {
          50: '#FDF9EB',
          100: '#F9EEC8',
          200: '#F1DC8F',
          300: '#E8C755',
          400: '#D9AE2E',
          500: '#B8901C',
          600: '#927012',
          700: '#6E540E',
        },
        teal: {
          50: '#E7F6F4',
          100: '#C2E9E4',
          200: '#8FD6CE',
          300: '#54BDB2',
          400: '#2BA6A0',
          500: '#1E8A84',
          600: '#176E69',
          700: '#115450',
        },
        muted: {
          DEFAULT: '#8A847C',
          soft: '#B5AFA6',
        },
      },
      fontFamily: {
        serif: ['var(--font-display)', 'Fraunces', 'Georgia', 'serif'],
        sans: ['var(--font-body)', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      boxShadow: {
        // Soft depth: a tight contact shadow layered under a soft ambient one.
        card: '0 1px 2px rgba(28,26,23,0.04), 0 12px 28px -12px rgba(28,26,23,0.16)',
        edge: 'inset 0 0 0 1px rgba(28,26,23,0.08)',
        glass: '0 1px 2px rgba(28,26,23,0.04), 0 12px 28px -12px rgba(28,26,23,0.16)',
        ring: '0 0 0 1px rgba(5,150,105,0.15)',
        // Deeper elevation for the opt-in hover-lift state.
        brandLiftHover: '0 2px 4px rgba(28,26,23,0.05), 0 20px 40px -16px rgba(28,26,23,0.24)',
        // Coloured lift shadows: the ambient layer carries a faint accent tint so
        // tinted card variants read as gently glowing rather than flat grey.
        brandLift: '0 1px 2px rgba(28,26,23,0.04), 0 14px 30px -14px rgba(5,150,105,0.28)',
        amberLift: '0 1px 2px rgba(28,26,23,0.04), 0 14px 30px -14px rgba(217,174,46,0.30)',
        tealLift: '0 1px 2px rgba(28,26,23,0.04), 0 14px 30px -14px rgba(43,166,160,0.28)',
        sageLift: '0 1px 2px rgba(28,26,23,0.04), 0 14px 30px -14px rgba(46,143,103,0.28)',
        terracottaLift: '0 1px 2px rgba(28,26,23,0.04), 0 14px 30px -14px rgba(181,83,42,0.26)',
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #059669 0%, #34D399 50%, #2BA6A0 100%)',
        'gradient-warm': 'linear-gradient(135deg, #D9AE2E 0%, #D17B4F 55%, #B5532A 100%)',
        'gradient-cool': 'linear-gradient(135deg, #059669 0%, #2BA6A0 100%)',
        'gradient-fresh': 'linear-gradient(135deg, #2BA6A0 0%, #2E8F67 100%)',
      },
      letterSpacing: {
        widish: '0.18em',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up 600ms ease-out both',
        'fade-in': 'fade-in 600ms ease-out both',
      },
    },
  },
  plugins: [],
} satisfies Config;
