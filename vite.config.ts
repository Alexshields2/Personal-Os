import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' keeps asset URLs relative so the build works from a file://,
// a subpath (GitHub Pages project site) or a domain root without changes.
export default defineConfig({
  base: './',
  plugins: [react()],
  // Bind IPv4 explicitly: left to itself this environment binds only [::1],
  // which localhost clients can't reach.
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  build: { outDir: 'dist', sourcemap: false },
})
