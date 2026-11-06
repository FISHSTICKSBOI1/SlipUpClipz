import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const dir = process.env.SLIPUPCLIPZ_FEEDBACK_DIR || join(root, '.netlify', 'feedback-dev')

if (!existsSync(dir)) {
  console.log(`No local survey responses at ${dir}`)
  process.exit(0)
}

const responses = readdirSync(dir)
  .filter((file) => file.startsWith('response_') && file.endsWith('.json'))
  .map((file) => JSON.parse(readFileSync(join(dir, file), 'utf8')))
  .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))

const heardFrom = {}
const downloadSource = {}
for (const response of responses) {
  heardFrom[response.heardFrom] = (heardFrom[response.heardFrom] || 0) + 1
  downloadSource[response.downloadSource] = (downloadSource[response.downloadSource] || 0) + 1
}

const report = {
  count: responses.length,
  heardFrom,
  downloadSource,
  responses,
}

mkdirSync(join(root, '.netlify'), { recursive: true })
const outFile = join(root, '.netlify', 'feedback-export.json')
writeFileSync(outFile, JSON.stringify(report, null, 2), 'utf8')
console.log(`Saved ${responses.length} local survey response(s) to ${outFile}`)
console.log(JSON.stringify({ count: report.count, heardFrom, downloadSource }, null, 2))
