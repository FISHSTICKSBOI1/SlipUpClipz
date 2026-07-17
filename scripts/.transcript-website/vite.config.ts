import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root,
  plugins: [react()],
  publicDir: path.join(root, 'public'),
  resolve: {
    alias: {
      '@site': path.join(root, 'src'),
    },
  },
  // Inline PostCSS so Vite never falls back to the monorepo-root Tailwind config.
  css: {
    postcss: {
      plugins: [
        tailwindcss({ config: path.join(root, 'tailwind.config.js') }),
        autoprefixer(),
      ],
    },
  },
  css: {
    postcss: path.join(root, 'postcss.config.js'),
  },
  build: {
    outDir: path.join(root, '..', 'dist-website'),
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 5174,
    strictPort: true,
  },
  preview: {
    port: 4174,
    strictPort: true,
  },
})
