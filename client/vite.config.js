import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // '/' when served from a domain root (Render single-service); './' for GitHub Pages subpaths.
  base: process.env.VITE_BASE_PATH || '/',
  server: {
    port: 4000,
    host: true, // Expose to local network
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true
      }
    }
  }
})
