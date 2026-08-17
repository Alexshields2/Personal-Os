import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' keeps asset URLs relative so the build works from a file://,
// a subpath (GitHub Pages project site) or a domain root without changes.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
})
