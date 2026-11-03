import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'

const shared = fileURLToPath(new URL('../shared', import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@shared': shared } },
  server: {
    port: 3000,
    host: true,
    fs: { allow: ['..'] },
    proxy: {
      '/api': 'http://localhost:5055',
      '/socket.io': { target: 'http://localhost:5055', ws: true },
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: { react: ['react', 'react-dom', 'react-router-dom'], motion: ['framer-motion'] },
      },
    },
  },
})
