import { copyFileSync } from 'fs';
import { resolve } from 'path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages serves 404.html for unknown paths; making it a copy of index.html lets
// deep links such as /fraudmirror/alerts load the single-page app.
const spaFallback = (): Plugin => ({
  name: 'spa-404-fallback',
  apply: 'build',
  closeBundle() {
    copyFileSync(resolve(import.meta.dirname, 'dist/index.html'), resolve(import.meta.dirname, 'dist/404.html'));
  },
});

export default defineConfig(({ mode }) => ({
  // `vite build --mode pages` produces the static, server-less demo for GitHub Pages
  base: mode === 'pages' ? process.env.PAGES_BASE || '/fraudmirror/' : '/',
  plugins: [react(), tailwindcss(), ...(mode === 'pages' ? [spaFallback()] : [])],
  server: {
    port: 5173,
    fs: { allow: ['..'] }, // the demo build reuses the server's engine modules
    proxy: {
      '/api': 'http://localhost:4000',
      '/socket.io': { target: 'http://localhost:4000', ws: true },
    },
  },
}));
