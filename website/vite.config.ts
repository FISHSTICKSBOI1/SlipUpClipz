import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
