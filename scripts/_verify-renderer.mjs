import http from 'node:http'

function get(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let data = ''
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => resolve({ status: res.statusCode, data }))
      })
      .on('error', reject)
  })
}

const port = process.argv[2] || '5173'
const base = `http://localhost:${port}`

const waveform = await get(`${base}/src/lib/waveform.ts`)
const trim = await get(`${base}/src/components/clips/TrimEditor.tsx`)
const recorder = await get(`${base}/src/components/clips/RecorderPanel.tsx`)
const main = await get(`${base}/src/main.tsx`)
const tips = await get(`${base}/src/data/quickTips.ts`)

console.log(
  JSON.stringify(
    {
      port,
      waveformStatus: waveform.status,
      hasEstimateSilenceFloor: waveform.data.includes('export function estimateSilenceFloor'),
      trimImportsEstimate: /import\s*\{[^}]*estimateSilenceFloor[^}]*\}\s*from/.test(trim.data),
      recorderUsesBtnClip: recorder.data.includes('btn-clip'),
      mainHasErrorBoundary: main.data.includes('AppErrorBoundary'),
      tipsOk: tips.data.includes('QUICK_TIPS'),
    },
    null,
    2,
  ),
)
