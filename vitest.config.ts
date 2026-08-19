import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default defineConfig((env) => {
  const baseConfig = typeof viteConfig === 'function' ? viteConfig(env) : viteConfig;
  return mergeConfig(
    baseConfig,
    defineConfig({
      test: {
        environment: 'jsdom',
        include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'worker/src/**/*.test.ts'],
        globals: true,
        setupFiles: ['./src/test/setup.ts'],
      },
    })
  );
});
