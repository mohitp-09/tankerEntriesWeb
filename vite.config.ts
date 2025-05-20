import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'Tanker Management System',
        short_name: 'GangaWater',
        description: 'Professional tanker management system for tracking and managing tanker entries',
        theme_color: '#1E40AF',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/drop-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/drop.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/drop-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
