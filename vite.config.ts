import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { devApiProxy } from './src/config/devApiProxy.js';

// Vite configuration for the Community Emergency Response Platform.
// Preserves React, PWA (injectManifest), server/proxy, preview, and test settings.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: false,
      registerType: 'prompt',
      manifest: {
        name: 'Community Emergency Response Platform',
        short_name: 'EmergencyApp',
        description:
          'Community Emergency Response Platform for incident coordination and emergency support.',
        theme_color: '#FAF7F2',
        background_color: '#FAF7F2',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{html,js,css,svg,png,woff2}'],
      },
      // Ensure API requests are forwarded with credentials.
      workbox: {
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly'
          },
        ],
      },
    }),
  ],

  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router-dom/')
          ) {
            return 'vendor-react';
          }
        },
      },
    },
  },

  server: {
    proxy: devApiProxy,
    watch: {
      ignored: ['**/backend/**', '**/db.sqlite3', '**/db.sqlite3-journal'],
    },
  },

  preview: {
    proxy: devApiProxy,
    // Allowed host for the dev tunnel preview.
    allowedHosts: ['m4n4jr4f-4173.inc1.devtunnels.ms'],
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
