import { app } from 'electron'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { componentDirectory, localAppDataDirectory } from './aiComponent.js'
import {
  acquireWorkerClaim,
  AiWorkerController,
  localPortBusy,
  probeAiServer,
  releaseWorkerClaim,
  resolveAiRuntime,
  startUvicornWorker,
  updateWorkerClaim,
  workerClaimHeld,
} from './aiWorkerControl.js'

let controller: AiWorkerController | null = null

export function getAiWorker(): AiWorkerController {
  if (controller) return controller
  const componentRoot = componentDirectory(localAppDataDirectory(app.getPath('appData')))
  const runtime = resolveAiRuntime(process.env.APP_ROOT ?? '', app.isPackaged
    ? {
        packaged: true,
        resourcesPath: process.resourcesPath,
        componentRoot,
        logDir: path.join(path.dirname(componentRoot), 'ai-logs'),
      }
    : {})
  const claimDir = path.join(localAppDataDirectory(app.getPath('appData')), 'SlipUpClipz')
  const created = new AiWorkerController({
    canStart: () => existsSync(runtime.pythonPath) && existsSync(runtime.serverPath),
    portBusy: () => localPortBusy(),
    probe: probeAiServer,
    claim: () => acquireWorkerClaim(claimDir),
    releaseClaim: () => releaseWorkerClaim(claimDir),
    peekClaim: () => workerClaimHeld(claimDir),
    noteWorkerPid: (pid) => updateWorkerClaim(claimDir, pid),
    spawn: (token) => startUvicornWorker(runtime, (line) => created.remember(line), token),
    log: (line) => {
      console.log(`[ai-worker] ${line}`)
    },
  })
  controller = created
  return created
}

export async function shutdownAiWorker(): Promise<void> {
  if (!controller) return
  const current = controller
  controller = null
  await current.shutdown()
}
