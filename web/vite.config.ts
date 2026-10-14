import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => ({
  // Standalone: relative asset URLs, so it works on GitHub Pages or any sub-path.
  // Site: served by the portfolio at /lab, whose URL has no trailing slash, so
  // relative URLs would resolve against "/" there.
  base: mode === 'site' ? '/lab/' : './',
  plugins: [react()],
  worker: { format: 'es' },
  server: { fs: { allow: ['..'] } },
  build: { target: 'es2022', sourcemap: mode !== 'site', outDir: mode === 'site' ? 'dist-site' : 'dist' },
  test: { include: ['tests/**/*.test.ts'], testTimeout: 30_000 },
}))
