/** Ask the main process. A missing bridge denies the cut instead of trusting the window. */
export async function requestRemoveSelectionAuthorization(): Promise<boolean> {
  const request = window.electronAPI?.clips?.authorizeRemoveSelection
  if (!request) return false
  try {
    const result = await request()
    return result.ok === true
  } catch {
    return false
  }
}
