import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

    // build v2

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
})
