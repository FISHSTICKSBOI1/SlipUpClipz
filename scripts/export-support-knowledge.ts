import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildSupportKnowledgePayload,
  formatSupportKnowledgeContext,
} from '../website/src/data/supportKnowledge.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'netlify', 'lib')
const outFile = path.join(outDir, 'support-knowledge.json')

const payload = buildSupportKnowledgePayload()
const context = formatSupportKnowledgeContext(payload)

mkdirSync(outDir, { recursive: true })
writeFileSync(
  outFile,
  JSON.stringify({ ...payload, context }, null, 2),
  'utf8',
)

console.log(`[export-support-knowledge] Wrote ${outFile}`)
