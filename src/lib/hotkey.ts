export function formatHotkey(event: KeyboardEvent): string {
  const parts: string[] = []

  if (event.ctrlKey) parts.push('Ctrl')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  if (event.metaKey) parts.push('Meta')

  const key = event.key
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
    return parts.join('+')
  }

  const displayKey = key.length === 1 ? key.toUpperCase() : key
  parts.push(displayKey)

  return parts.join('+')
}

export function isModifierOnly(event: KeyboardEvent): boolean {
  return ['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)
}

export function shouldIgnoreGlobalHotkey(event: KeyboardEvent): boolean {
  if (document.querySelector('[data-hotkey-capture]')) return true

  const target = event.target
  if (!(target instanceof HTMLElement)) return false

  if (target.isContentEditable) return true

  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"]'),
  )
}

export function hotkeyToAccelerator(hotkey: string): string {
  return hotkey
    .split('+')
    .map((part) => {
      if (part === 'Ctrl') return 'CommandOrControl'
      if (part === 'Meta') return 'Super'
      return part
    })
    .join('+')
}
