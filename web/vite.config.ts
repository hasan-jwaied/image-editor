import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => ({
  // Relative URLs work on any sub-path, except /lab (no trailing slash) on the portfolio.
  base: mode === 'site' ? '/lab/' : './',
  plugins: [react()],
  // Safari 14 has no module workers.
  worker: { format: 'iife' },
  server: { fs: { allow: ['..'] } },
  build: { target: ['es2020', 'safari14'], sourcemap: mode !== 'site', outDir: mode === 'site' ? 'dist-site' : 'dist' },
  test: { include: ['tests/**/*.test.ts'], testTimeout: 30_000 },
}))
