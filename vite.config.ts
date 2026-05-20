import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const skipPwa = process.env.SKIP_PWA === '1'
const rootDir = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  resolve: skipPwa
    ? {
        alias: {
          'virtual:pwa-register': path.resolve(rootDir, 'src/pwa/register-stub.ts'),
        },
      }
    : undefined,
  plugins: [
    react(),
    ...(skipPwa
      ? []
      : [
          VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
      },
      manifest: {
        name: 'Mentell',
        short_name: 'Mentell',
        description: 'Local-first stationery journal',
        theme_color: '#505153',
        background_color: '#505153',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/pwa.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
          },
        ],
      },
          }),
        ]),
  ],
})
