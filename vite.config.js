import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      // O código usa imports com prefixo '@/' apontando para ./src
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Escuta em toda a rede (necessário para túnel HTTPS / teste no celular).
    host: true,
    // Encaminha /api para o backend. Assim o app usa um único endereço (o do
    // Vite/túnel) e o celular não precisa acessar o backend diretamente.
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
    // Permite o host do túnel (Cloudflare/ngrok geram domínios dinâmicos).
    allowedHosts: true,
  },
})