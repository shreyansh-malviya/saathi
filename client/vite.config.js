import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Same-origin API in dev, just like production on Vercel.
    proxy: { '/api': 'http://localhost:5050' },
  },
});
