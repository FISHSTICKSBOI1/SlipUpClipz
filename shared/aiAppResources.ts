export const REQUIRED_AI_APP_MODULES = [
  'server.py',
  'server_temp_outputs.py',
  'generation_guard.py',
  'reference_audio.py',
] as const

export function extraResourceDestination(entry: { from?: string; to?: string }): string {
  return String(entry.to ?? '')
}

export function missingAiAppModules(destinations: string[]): string[] {
  const present = new Set(
    destinations
      .map((destination) => destination.replace(/\\/g, '/'))
      .filter((destination) => destination.startsWith('ai-app/'))
      .map((destination) => destination.slice('ai-app/'.length)),
  )
  return REQUIRED_AI_APP_MODULES.filter((name) => !present.has(name))
}

export function packagedAiAppPath(resourcesRoot: string, moduleName: string): string {
  return `${resourcesRoot.replace(/[\\/]+$/, '')}/ai-app/${moduleName}`
}
