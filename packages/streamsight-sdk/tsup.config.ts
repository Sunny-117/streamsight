import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true, // 重新启用 DTS 生成
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: true,
  target: 'es2020',
  external: ['rrweb', 'streamsight-core-utils'],
  esbuildOptions(options) {
    options.banner = {
      js: '"use client";',
    }
  },
})