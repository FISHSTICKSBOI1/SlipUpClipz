/** Customer-facing AI Clone text. The original error stays in the local log. */
export function customerAiMessage(raw: string): string {
  const text = raw
    .replace(/Error invoking remote method '[^']+':\s*/gi, '')
    .replace(/^Error:\s*/i, '')
    .trim()
  if (!text) return 'AI Clone could not finish. Try again.'
  if (/will not change Windows virtual-memory settings/i.test(text)) return text
  if (/paging file is too small|os error 1455/i.test(text)) {
    return 'Windows ran out of memory while loading the voice model. Close other programs and try again. SlipUpClipz will not change Windows virtual-memory settings.'
  }
  if (/another program is using the local AI port/i.test(text)) {
    return 'AI Clone is already in use. Close any other SlipUpClipz window, then try again.'
  }
  if (/still working/i.test(text)) {
    return 'The voice engine is still working. Try again in a moment.'
  }
  if (/still starting/i.test(text)) {
    return 'The voice engine is still starting. Try again in a moment.'
  }
  if (/took too long to finish/i.test(text)) {
    return 'AI Clone took too long to finish. Try again.'
  }
  if (/stopped before it finished/i.test(text)) {
    return 'AI Clone stopped before the voice was ready. Try again.'
  }
  if (/took too long to start/i.test(text)) {
    return 'The voice engine took too long to start. Try again when the computer is less busy.'
  }
  if (/speaker permission is required/i.test(text)) {
    return 'Check the speaker permission box before generating.'
  }
  return text
}
