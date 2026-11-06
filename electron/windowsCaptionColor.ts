/** App surface sampled behind the top bar, which the scrim blends over. */
const SURFACE = { r: 14, g: 17, b: 26 }

/** Windows resets a caption attribute when the color is this value. */
export const CAPTION_COLOR_DEFAULT = -1

/** Light caption text so the title and window buttons stay readable on the dim bar. */
export const MODAL_CAPTION_TEXT_HEX = '#f2f3f8'

export function scrimCaptionHex(opacity: number): string {
  const keep = 1 - opacity
  const channel = (value: number) =>
    Math.round(value * keep)
      .toString(16)
      .padStart(2, '0')
  return `#${channel(SURFACE.r)}${channel(SURFACE.g)}${channel(SURFACE.b)}`
}

/** `#rrggbb` to a COLORREF (`0x00bbggrr`). */
export function colorRefFromHex(hex: string): number {
  const n = Number.parseInt(hex.replace('#', ''), 16)
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  return (b << 16) | (g << 8) | r
}

export function nextModalDepth(depth: number, active: boolean): number {
  if (active) return depth + 1
  return Math.max(0, depth - 1)
}
