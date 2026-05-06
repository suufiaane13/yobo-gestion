import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    // Doit rester aligné avec `src-tauri/tauri.conf.json` → build.devUrl
    port: 5173,
    // Si 5173 est pris (vieux `vite` / autre app), on échoue au lieu de passer à 5174
    // (sinon Tauri charge encore 5173 et l’UI ne correspond pas au bon serveur).
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react')) return 'vendor-react'
            if (id.includes('material-symbols')) return 'vendor-ui'
            return 'vendor'
          }
        },
      },
    },
  },
})
