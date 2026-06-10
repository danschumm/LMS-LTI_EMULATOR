import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    hmr: {
      host: 'localhost'
    },
    proxy: {
      '/api': 'http://localhost:3001',
      '/deep-link': 'http://localhost:3001',
      '/.well-known': 'http://localhost:3001'
    }
  }
});
