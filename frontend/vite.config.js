import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 3000,
    host: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2015',
    rollupOptions: {
      output: {
        manualChunks: undefined,
      }
    }
  },
  optimizeDeps: {
    exclude: ['@reduxjs/toolkit']
  },
  esbuild: {
    target: 'es2015',
    minify: mode === 'production',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment'
  }
}))
