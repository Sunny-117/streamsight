import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  external: ['@bokuweb/zstd-wasm'],
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false, // 工具库不压缩，便于调试
  target: 'es2020',
  outDir: 'dist',
})
