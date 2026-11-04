import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

// Brand palette lifted from App.css — the approved look stays identical (option 1).
const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        // Primary brand (teal, from --brand / brand-*)
        brand: {
          50: { value: '#effcf7' },
          100: { value: '#d7f7ea' },
          200: { value: '#b0edda' },
          500: { value: '#1ea88d' },
          600: { value: '#128873' },
          700: { value: '#106d5e' },
          800: { value: '#10574c' },
          900: { value: '#0f4940' },
        },
        // Accent (purple, from --blue / #7067f0)
        accent: {
          50: { value: '#eeecff' },
          100: { value: '#dcd9ff' },
          500: { value: '#7067f0' },
          600: { value: '#6259db' },
          700: { value: '#514ac4' },
        },
        // Sidebar navy (from --navy / --navy-soft)
        navy: {
          900: { value: '#171626' },
          800: { value: '#211f35' },
          700: { value: '#2d2a4c' },
        },
        // Page canvas (from --canvas)
        canvas: { value: '#f7f7fb' },
        // Paper format row colors (golongan table)
        paper: {
          cream: { value: '#fef9e7' },
          green: { value: '#d5f5e3' },
          blue: { value: '#d6eaf8' },
          yellow: { value: '#fcf3cf' },
          header: { value: '#f8fafc' },
        },
      },
      radii: {
        md: { value: '7px' },
        lg: { value: '9px' },
        xl: { value: '11px' },
      },
      fontSizes: {
        xs: { value: '11px' },
        sm: { value: '12px' },
        md: { value: '13px' },
      },
    },
    semanticTokens: {
      colors: {
        // Nested keys — flat 'fg.subtle' loses to defaultConfig's nested fg.subtle
        bg: {
          default: { value: 'white' },
          canvas: { value: '{colors.canvas}' },
          sidebar: { value: '{colors.navy.900}' },
        },
        fg: {
          default: { value: '#1d1b2d' },
          muted: { value: '#63616f' },
          subtle: { value: '#706e84' },
        },
        border: {
          default: { value: '#e9e8f0' },
        },
        brand: {
          solid: { value: '{colors.brand.600}' },
          subtle: { value: '{colors.brand.50}' },
        },
        accent: {
          solid: { value: '{colors.accent.500}' },
          subtle: { value: '{colors.accent.50}' },
        },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
