import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Multi-page build. The main site is `/`; the MadHive dashboard is a second
// HTML entry that builds to dist/madhive/index.html — a real directory, so a
// direct link works on GitHub Pages without SPA-fallback tricks.
export default defineConfig({
  plugins: [react()],
  base: "./",  // This ensures assets are loaded correctly on GitHub Pages
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        // The dashboard lives at /madhive/. /madhive/v2/ is a redirect kept so
        // links shared while it lived there still resolve.
        madhive: 'madhive/index.html',
        madhiveV2: 'madhive/v2/index.html',
        madhiveModels: 'madhive/models/index.html',
        modeling: 'madhive/modeling/index.html',
      },
    },
  },
})
