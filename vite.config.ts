import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Multi-page build. The main site is `/`; the ad-tech dashboard is a second
// HTML entry that builds to dist/adtech-dashboard/index.html — a real
// directory, so a direct link works on GitHub Pages without SPA-fallback tricks.
export default defineConfig({
  plugins: [react()],
  base: "./",  // This ensures assets are loaded correctly on GitHub Pages
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        // The dashboard lives at /adtech-dashboard/. Everything under
        // /madhive/ (its old home, and /madhive/v2/ before that) is a redirect
        // kept so links shared while it lived there still resolve.
        adtechDashboard: 'adtech-dashboard/index.html',
        adtechDashboardModels: 'adtech-dashboard/models/index.html',
        modeling: 'adtech-dashboard/modeling/index.html',
        madhive: 'madhive/index.html',
        madhiveV2: 'madhive/v2/index.html',
        madhiveModels: 'madhive/models/index.html',
        madhiveModeling: 'madhive/modeling/index.html',
      },
    },
  },
})
