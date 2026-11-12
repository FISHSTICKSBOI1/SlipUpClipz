import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests', timeout: 45000, fullyParallel: false, workers: 1,
  reporter: [['list'], ['json', { outputFile: '../docs/website-review/browser-results.json' }]],
  outputDir: '../test-results/website',
  use: { baseURL: 'http://127.0.0.1:4174', channel: 'msedge', headless: true,
    viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'node node_modules/vite/bin/vite.js preview --config website/vite.config.ts --host 127.0.0.1',
    cwd: '..', url: 'http://127.0.0.1:4174', reuseExistingServer: true },
})
