import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // HMR WebSocket: browser is served via nginx on :8080, not directly on :5173.
    // Pin the client port and protocol so Vite doesn't try to reach an
    // unreachable port and fall back to expensive full reloads.
    hmr: {
      clientPort: 8080,
      protocol: 'ws',
      host: 'localhost',
    },
    proxy: {
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
      },
    },
  },
})
