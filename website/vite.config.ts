import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import type { IncomingMessage } from 'node:http'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const require = createRequire(import.meta.url)

const root = path.dirname(fileURLToPath(import.meta.url))

function localNetlifyFunctions(): Plugin {
  const handlers: Record<string, string> = {
    'submit-survey': '../netlify/functions/submit-survey.cjs',
    'create-checkout': '../netlify/functions/create-checkout.cjs',
    'pricing-quote': '../netlify/functions/pricing-quote.cjs',
    'survey-export': '../netlify/functions/survey-export.cjs',
    'billing-portal': '../netlify/functions/billing-portal.cjs',
    'billing-recovery': '../netlify/functions/billing-recovery.cjs',
    'billing-recovery-redeem': '../netlify/functions/billing-recovery-redeem.cjs',
    'release-license': '../netlify/functions/release-license.cjs',
    'device-transfer': '../netlify/functions/device-transfer.cjs',
    'device-transfer-confirm': '../netlify/functions/device-transfer-confirm.cjs',
  }

  return {
    name: 'slipupclipz-local-functions',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0] ?? ''
        if (url === '/download/latest') {
          res.statusCode = 302
          res.setHeader('Location', '/.netlify/functions/download-latest')
          res.setHeader('Cache-Control', 'no-store')
          res.end()
          return
        }
        const match = url.match(/^\/\.netlify\/functions\/([a-z0-9-]+)\/?$/)
        if (match?.[1] === 'download-latest') {
          try {
            const loaded = (await import(
              pathToFileURL(path.join(root, '../netlify/functions/download-latest.js')).href
            )) as {
              handler: () => Promise<{ statusCode?: number; headers?: Record<string, string> }>
            }
            const result = await loaded.handler()
            res.statusCode = result.statusCode || 302
            for (const [key, value] of Object.entries(result.headers || {})) {
              if (value != null) res.setHeader(key, value)
            }
            res.end()
          } catch (error) {
            res.statusCode = 500
            res.end(error instanceof Error ? error.message : 'Download redirect failed')
          }
          return
        }

        const handlerPath = match ? handlers[match[1]] : undefined
        if (!handlerPath) {
          next()
          return
        }

        try {
          const loaded = require(handlerPath) as {
            handler: (event: Record<string, unknown>) => Promise<{
              statusCode?: number
              headers?: Record<string, string>
              body?: string
            }>
          }
          const body = await readRequestBody(req)
          const result = await loaded.handler({
            httpMethod: req.method || 'GET',
            headers: req.headers,
            body: body || null,
            isBase64Encoded: false,
            path: url,
          })
          res.statusCode = result.statusCode || 200
          for (const [key, value] of Object.entries(result.headers || {})) {
            if (value != null) res.setHeader(key, value)
          }
          res.end(result.body ?? '')
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              error: error instanceof Error ? error.message : 'Local function failed',
            }),
          )
        }
      })
    },
  }
}

function readRequestBody(req: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function staticPreviewResponses(): Plugin {
  return {
    name: 'slipupclipz-static-preview',
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = req.url?.split('?')[0] ?? ''
        if (pathname === '/download/latest' || pathname === '/.netlify/functions/download-latest') {
          res.writeHead(302, { Location: '/download?preview=installer', 'Cache-Control': 'no-store' })
          res.end()
          return
        }
        if (!pathname.startsWith('/.netlify/functions/')) return next()

        const message = pathname === '/.netlify/functions/submit-survey'
          ? 'Survey submissions are unavailable in the static preview. Your answers were not saved.'
          : pathname === '/.netlify/functions/create-checkout'
            ? 'Checkout is unavailable in the static preview. No payment was started.'
            : 'This service is unavailable in the static preview.'
        res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
        res.end(JSON.stringify({ error: message }))
      })
    },
  }
}

export default defineConfig({
  root,
  plugins: [react(), localNetlifyFunctions(), staticPreviewResponses()],
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
