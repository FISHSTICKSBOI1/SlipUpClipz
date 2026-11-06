import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BrowserWindow } from 'electron'
import {
  CAPTION_COLOR_DEFAULT,
  MODAL_CAPTION_TEXT_HEX,
  colorRefFromHex,
  nextModalDepth,
  scrimCaptionHex,
} from './windowsCaptionColor.js'

const CAPTION_ATTR = 35
const BORDER_ATTR = 34
const TEXT_ATTR = 36

const HELPER_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class SlipCaption {
  [DllImport("dwmapi.dll")]
  public static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);
  public static void Apply(long hwnd, int attr, int color) {
    DwmSetWindowAttribute(new IntPtr(hwnd), attr, ref color, 4);
  }
}
"@
[Console]::Out.WriteLine('ready')
[Console]::Out.Flush()
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line -or $line -eq 'quit') { break }
  $parts = $line.Split(',')
  [SlipCaption]::Apply([int64]$parts[0], [int32]$parts[1], [int32]$parts[2]) | Out-Null
  [Console]::Out.WriteLine('ok')
  [Console]::Out.Flush()
}
`

let helper: ChildProcessWithoutNullStreams | null = null
let ready: Promise<void> | null = null
let depth = 0

function helperProcess(): Promise<void> {
  if (ready) return ready
  const dir = mkdtempSync(join(tmpdir(), 'slipupclipz-caption-'))
  const scriptPath = join(dir, 'caption.ps1')
  writeFileSync(scriptPath, HELPER_SCRIPT, 'utf8')
  const child = spawn(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
    { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
  )
  helper = child
  ready = new Promise((resolve, reject) => {
    let buffer = ''
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString('utf8')
      if (buffer.includes('ready')) {
        child.stdout.off('data', onData)
        resolve()
      }
    }
    child.stdout.on('data', onData)
    child.once('error', reject)
    child.once('exit', (code) => {
      if (helper === child) {
        helper = null
        ready = null
      }
      reject(new Error(`Caption helper exited (${code ?? 'unknown'})`))
    })
  })
  ready.catch(() => {
    if (helper === child) {
      helper = null
      ready = null
    }
  })
  return ready
}

async function apply(win: BrowserWindow, caption: number, text: number): Promise<void> {
  if (process.platform !== 'win32' || win.isDestroyed()) return
  try {
    await helperProcess()
  } catch (error) {
    console.error('Modal caption color was not applied.', error)
    return
  }
  const child = helper
  if (!child || win.isDestroyed()) return
  const hwnd = win.getNativeWindowHandle().readBigUInt64LE(0).toString()
  const border = caption
  child.stdin.write(`${hwnd},${CAPTION_ATTR},${caption}\n`)
  child.stdin.write(`${hwnd},${BORDER_ATTR},${border}\n`)
  child.stdin.write(`${hwnd},${TEXT_ATTR},${text}\n`)
}

export function setWindowModalScrim(
  win: BrowserWindow | null,
  active: boolean,
  opacity = 0.6,
): void {
  const previous = depth
  depth = nextModalDepth(depth, active)
  if (!win || process.platform !== 'win32') return
  if (depth === 0 && previous > 0) {
    void apply(win, CAPTION_COLOR_DEFAULT, CAPTION_COLOR_DEFAULT)
    return
  }
  if (active && depth >= 1) {
    const safeOpacity = Math.min(1, Math.max(0, opacity))
    void apply(
      win,
      colorRefFromHex(scrimCaptionHex(safeOpacity)),
      colorRefFromHex(MODAL_CAPTION_TEXT_HEX),
    )
  }
}

export function shutdownWindowsCaption(): void {
  depth = 0
  const child = helper
  helper = null
  ready = null
  if (!child) return
  child.stdin.write('quit\n')
  child.kill()
}
