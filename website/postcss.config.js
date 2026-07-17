import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

const root = path.dirname(fileURLToPath(import.meta.url))

/** Kept for tooling that loads PostCSS by directory; Vite uses the inline config. */
export default {
  plugins: [
    tailwindcss({ config: path.join(root, 'tailwind.config.js') }),
    autoprefixer(),
  ],
}
