import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy : {
      //Forward API requests to the backend server
      '/api' : {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      //Forward Sanctum cookie requests to the backend server 
      '/sanctum' : {
        target: 'http://localhost:8000',
        changeOrigin:true,
        secure:false,
      }
    }
  }
})
