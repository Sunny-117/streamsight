import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
  resolve: {
    alias: {
  'streamsight': new URL('../../packages/streamsight-sdk/dist/index.mjs', import.meta.url).pathname,
  'streamsight-core-utils': new URL('../../packages/core-utils/dist/index.mjs', import.meta.url).pathname,
    },
  },
  optimizeDeps: {
  exclude: ['rrweb', 'streamsight', 'streamsight-core-utils', '@bokuweb/zstd-wasm'],
  },
})
