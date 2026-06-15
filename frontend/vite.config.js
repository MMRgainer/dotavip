import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',   // relative asset paths so the packaged app loads from file://

  build: {
    minify: false,
  },

  server: {
    port: 5173,
    middlewareMode: false,

    // Disable HMR for Electron (causes lag)
    hmr: false,

    // Proxy API to backend
    proxy: {
      '/api': { target: 'http://127.0.0.1:8765', rewrite: path => path.replace(/^\/api/, '') },
      '/health': 'http://127.0.0.1:8765',
      '/state':  'http://127.0.0.1:8765',
      '/ws': {
        target: 'ws://127.0.0.1:8765',
        ws: true,
      },
    },
  },
})
