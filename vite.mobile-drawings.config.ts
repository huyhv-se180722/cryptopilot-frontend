import { defineConfig } from 'vite';

/**
 * The drawing layer of the mobile app's chart page (T-153): the web's
 * drawing engine in one script, copied to `cryptopilot-mobile`
 * `assets/chart/drawings.js`. The page loads Lightweight Charts itself, so
 * only the engine is bundled.
 */
export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'dist-mobile',
    emptyOutDir: true,
    lib: {
      entry: 'src/features/chart/drawing/mobile/entry.ts',
      name: 'CPDrawingsBundle',
      formats: ['iife'],
      fileName: () => 'drawings.js',
    },
    rolldownOptions: {
      output: {
        postBanner:
          '/* CryptoPilot drawing layer (D-149, T-153), built from cryptopilot-frontend src/features/chart/drawing with `npm run build:mobile-drawings`. Do not edit here. */',
      },
    },
  },
});
