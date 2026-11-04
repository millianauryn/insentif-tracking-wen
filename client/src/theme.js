import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

// Brand palette lifted from App.css — the approved look stays identical (option 1).
const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        // Primary brand (teal, from --brand / brand-*)
        brand: {
          50: { value: '#e9f4f0' },
          100: { value: '#d8ebe4' },
          200: { value: '#b8ddd1' },
          500: { value: '#17836c' },
          600: { value: '#0f6b58' },
          700: { value: '#0c5848' },
          800: { value: '#0a493c' },
          900: { value: '#083a30' },
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
        canvas: { value: '#f4f8f6' },
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
          default: { value: '#16221e' },
          muted: { value: '#58665f' },
          subtle: { value: '#6c7a73' },
        },
        border: {
          default: { value: '#e2e9e6' },
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
