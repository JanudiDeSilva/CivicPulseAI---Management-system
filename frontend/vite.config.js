import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Backend Express API routes
      '/register': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/login': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/otp': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/user': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/predict': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/reports': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/stats': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/map-pins': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/duplicate-incidents': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/incidents': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      }
    }
  }
})
