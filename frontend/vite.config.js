import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [react()],
    css: {
      postcss: true,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: env.VITE_BACKEND_HOST || 'http://localhost:8000',
          changeOrigin: true,
        },
        '/ws': {
          target: env.VITE_WS_HOST || env.VITE_BACKEND_HOST?.replace('https://', 'wss://').replace('http://', 'ws://') || 'ws://localhost:8000',
          ws: true,
          changeOrigin: true,
        },
      },
    },
  }
})
