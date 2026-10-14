import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Relative asset URLs so the build works on GitHub Pages, a sub-path of a
  // personal site, or inside an iframe without reconfiguration.
  base: './',
  plugins: [react()],
  worker: { format: 'es' },
  server: { fs: { allow: ['..'] } },
  build: { target: 'es2022', sourcemap: true },
  test: { include: ['tests/**/*.test.ts'], testTimeout: 30_000 },
})
