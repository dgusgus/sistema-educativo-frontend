import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // "@/stores/auth" en vez de "../../../stores/auth"
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3000,
    proxy: {
      // Toda petición que empiece con /api la reenvía al backend
      // El navegador cree que habla con localhost:3000 → sin CORS
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})