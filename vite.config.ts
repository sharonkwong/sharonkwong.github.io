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
        madhive: 'madhive/index.html',
        modeling: 'madhive/modeling/index.html',
        madhiveV2: 'madhive/v2/index.html',
        madhiveModels: 'madhive/models/index.html',
      },
    },
  },
})
