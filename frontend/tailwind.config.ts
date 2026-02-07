import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary - Deep Indigo
        primary: {
          25: '#f5f5ff',
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1', // DEFAULT
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        // Secondary - Teal/Cyan
        secondary: {
          25: '#f0fdfa',
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6', // DEFAULT
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
          950: '#042f2e',
        },
        // Accent - Violet
        accent: {
          25: '#faf5ff',
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6', // DEFAULT
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },
        // Semantic Colors
        success: {
          light: '#ecfdf5',
          main: '#10b981',
          dark: '#065f46',
          border: '#6ee7b7',
        },
        warning: {
          light: '#fffbeb',
          main: '#f59e0b',
          dark: '#92400e',
          border: '#fcd34d',
        },
        error: {
          light: '#fef2f2',
          main: '#ef4444',
          dark: '#991b1b',
          border: '#fca5a5',
        },
        info: {
          light: '#eff6ff',
          main: '#3b82f6',
          dark: '#1e40af',
          border: '#93c5fd',
        },
        // Neutral - Gray Scale
        neutral: {
          white: '#ffffff',
          25: '#fcfcfd',
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
          950: '#030712',
          black: '#000000',
        },
        // Agent Status Colors
        agent: {
          active: {
            bg: '#ecfdf5',
            text: '#065f46',
            dot: '#10b981',
          },
          idle: {
            bg: '#f3f4f6',
            text: '#4b5563',
            dot: '#9ca3af',
          },
          error: {
            bg: '#fef2f2',
            text: '#991b1b',
            dot: '#ef4444',
          },
          provisioning: {
            bg: '#eff6ff',
            text: '#1e40af',
            dot: '#3b82f6',
          },
          suspended: {
            bg: '#fffbeb',
            text: '#92400e',
            dot: '#f59e0b',
          },
        },
        // Container Health Colors
        container: {
          healthy: '#10b981',
          degraded: '#f59e0b',
          down: '#ef4444',
          unknown: '#9ca3af',
        },
        // Dark Mode Colors
        dark: {
          bg: {
            base: '#09090b',
            raised: '#0f0f12',
            overlay: '#18181b',
            muted: '#27272a',
            subtle: '#3f3f46',
          },
          text: {
            primary: '#fafafa',
            secondary: '#a1a1aa',
            muted: '#71717a',
            disabled: '#52525b',
          },
          border: {
            default: '#27272a',
            muted: '#1f1f23',
            strong: '#3f3f46',
            focus: '#818cf8',
          },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.01em' }],     // 12px
        sm: ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0em' }],    // 14px
        base: ['1rem', { lineHeight: '1.5rem', letterSpacing: '0em' }],       // 16px
        lg: ['1.125rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }], // 18px
        xl: ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],  // 20px
        '2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.02em' }],   // 24px
        '3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.02em' }], // 30px
        '4xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.03em' }],   // 36px
      },
      spacing: {
        '0.5': '2px',
        '1': '4px',
        '1.5': '6px',
        '2': '8px',
        '2.5': '10px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '8': '32px',
        '10': '40px',
        '12': '48px',
        '16': '64px',
        '20': '80px',
        '24': '96px',
      },
      borderRadius: {
        xs: '2px',
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
        '2xl': '16px',
        '3xl': '24px',
        full: '9999px',
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
        focus: '0 0 0 3px rgba(99, 102, 241, 0.3)',
        'focus-error': '0 0 0 3px rgba(239, 68, 68, 0.3)',
        'focus-success': '0 0 0 3px rgba(16, 185, 129, 0.3)',
      },
      transitionDuration: {
        instant: '50ms',
        fast: '150ms',
        normal: '200ms',
        moderate: '300ms',
        slow: '500ms',
        slower: '700ms',
      },
      transitionTimingFunction: {
        'ease-out-custom': 'cubic-bezier(0, 0, 0.2, 1)',
        'ease-in-out-custom': 'cubic-bezier(0.4, 0, 0.2, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      zIndex: {
        base: '0',
        sticky: '10',
        dropdown: '20',
        sidebar: '30',
        overlay: '40',
        modal: '50',
        popover: '60',
        toast: '70',
        splash: '80',
      },
      keyframes: {
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      animation: {
        'pulse-dot': 'pulse-dot 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
