const REQUIRED_AI_APP_MODULES = [
  'server.py',
  'server_temp_outputs.py',
  'generation_guard.py',
  'reference_audio.py',
]

function missingAiAppModulesFromDir(existsSync, join, resourcesRoot) {
  return REQUIRED_AI_APP_MODULES.filter(
    (name) => !existsSync(join(resourcesRoot, 'ai-app', name)),
  )
}

module.exports = {
  REQUIRED_AI_APP_MODULES,
  missingAiAppModulesFromDir,
}
