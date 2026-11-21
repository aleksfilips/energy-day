import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// BASE задаётся при сборке для GitHub Pages: BASE=/energy-day/ npm run build
const base = process.env.BASE ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Энергия дня',
        short_name: 'Энергия дня',
        description: 'Личный лунный календарь',
        lang: 'ru',
        theme_color: '#101626',
        background_color: '#101626',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/telegram\.org\/js\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'telegram-sdk' },
          },
        ],
      },
    }),
  ],
  worker: { format: 'es' },
  build: { target: 'es2020', chunkSizeWarningLimit: 900 },
});
