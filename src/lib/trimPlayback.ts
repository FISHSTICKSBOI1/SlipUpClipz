function targetTag(target: EventTarget | null): { tag: string; contentEditable: boolean } | null {
  if (!target || typeof target !== 'object' || !('tagName' in target)) return null
  const element = target as { tagName?: string; isContentEditable?: boolean }
  return {
    tag: element.tagName?.toUpperCase() ?? '',
    contentEditable: element.isContentEditable === true,
  }
}

export function isTextEntryTarget(target: EventTarget | null): boolean {
  const element = targetTag(target)
  if (!element) return false
  if (element.tag === 'INPUT' || element.tag === 'TEXTAREA' || element.tag === 'SELECT') return true
  return element.contentEditable
}

/**
 * Space plays or pauses while the trim editor is open.
 * A button inside the editor, such as Play, keeps its normal click.
 * The Trim button that opened the editor does not.
 */
export function spaceTrimDecision(target: EventTarget | null, insideEditor: boolean): 'play' | 'ignore' {
  if (isTextEntryTarget(target)) return 'ignore'
  const element = targetTag(target)
  if (element?.tag === 'BUTTON' && insideEditor) return 'ignore'
  return 'play'
}

/** Space starts or pauses trim playback unless a text field or the editor's own button owns the key. */
export function spaceTogglesTrimPlayback(target: EventTarget | null, insideEditor = false): boolean {
  return spaceTrimDecision(target, insideEditor) === 'play'
}

/** Playback starts at the playhead, clamped inside the trim selection. */
export function playbackStartSec(playheadSec: number, startSec: number, endSec: number): number {
  const upper = Math.max(startSec, endSec)
  return Math.max(startSec, Math.min(playheadSec, upper))
}
