import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// Dev-only: ?__seed=1 on any page forwards /api/auth/dev-login and passes its
// Set-Cookie through, so headless tooling (taste inspect, screenshots) can render
// authenticated screens without a login flow. configureServer = dev server only.
function authSeed() {
  const middleware = async (req, res, next) => {
    if (!req.url || !req.url.includes('__seed')) return next()
    try {
      const r = await fetch('http://localhost:3002/api/auth/dev-login?user=super', { method: 'POST' })
      const cookies = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : []
      if (cookies.length) res.setHeader('Set-Cookie', cookies)
    } catch {
      /* API down — page will render logged out */
    }
    next()
  }
  return {
    name: 'inspect-auth-seed',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), authSeed()],
  server: {
    proxy: {
      '/api': 'http://localhost:3002',
    },
  },
  preview: {
    proxy: {
      '/api': 'http://localhost:3002',
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-router')) return 'vendor-router';
            if (id.includes('@base-ui')) return 'vendor-base-ui';
            if (id.includes('@tanstack')) return 'vendor-query';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('react')) return 'vendor-react';
            return 'vendor';
          }
        },
      },
    },
  },
  test: {
    // render smoke tests import Chakra; 5s default flakes on a loaded machine
    testTimeout: 15000,
    hookTimeout: 15000,
  },
})
