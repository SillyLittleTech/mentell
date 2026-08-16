import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'

const skipPwa = process.env.SKIP_PWA === '1'
const offlineZip = process.env.VITE_OFFLINE_ZIP === '1'
const rootDir = path.dirname(fileURLToPath(import.meta.url))
/** Production: https://projects.sillylittle.tech/mentell/ — set via VITE_BASE in CI */
const base = process.env.VITE_BASE ?? '/'
const appVersion = readFileSync(path.join(rootDir, 'VERSION'), 'utf8').trim()

const prodPrecacheGlobs = [
  'index.html',
  'manifest.webmanifest',
  'manifest.json',
  'asset/mentell-icon.png',
  'assets/*.css',
  'assets/index-*.js',
]

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const enablePwaDevSw = command === 'serve' && mode !== 'debug'

  return {
  base,
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
  },
  resolve: skipPwa
    ? {
        alias: {
          'virtual:pwa-register': path.resolve(rootDir, 'src/pwa/register-stub.ts'),
        },
      }
    : undefined,
  plugins: [
    react(),
    ...(offlineZip ? [viteSingleFile()] : []),
    ...(skipPwa
      ? []
      : [
          VitePWA({
            strategies: 'injectManifest',
            srcDir: 'src/pwa',
            filename: 'sw.ts',
            injectRegister: null,
            registerType: 'autoUpdate',
            devOptions: {
              enabled: enablePwaDevSw,
              type: 'module',
              navigateFallback: 'index.html',
            },
            injectManifest: {
              maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
              /** App shell only — precaching transformers/PNGs/SVGs exceeds iOS SW quota and the worker never activates, so APNs is held until the PWA opens. */
              globPatterns: command === 'serve' ? [] : prodPrecacheGlobs,
              globIgnores: ['**/transformers-*', '**/node_modules/**'],
            },
            manifest: {
              id: base,
              name: 'Mentell',
              short_name: 'Mentell',
              description: 'Local-first stationery journal',
              theme_color: '#505153',
              background_color: '#505153',
              display: 'standalone',
              start_url: base,
              scope: base,
              prefer_related_applications: false,
              icons: [
                {
                  src: 'asset/mentell-icon.png',
                  sizes: '1024x1024',
                  type: 'image/png',
                  purpose: 'any',
                },
              ],
            },
          }),
        ]),
  ],
  }
})
