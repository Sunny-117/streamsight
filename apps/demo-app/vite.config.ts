import { defineConfig } from 'vite'

export default defineConfig({
  base: process.env.DEPLOY_GH_PAGES ? '/streamsight/' : '/',
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
  exclude: ['rrweb', 'rrweb-player', 'streamsight', 'streamsight-core-utils', '@bokuweb/zstd-wasm'],
  },
})
