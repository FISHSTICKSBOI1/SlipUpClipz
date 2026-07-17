# SlipUpClipz

Electron + React desktop app for instant replay clips, waveform trimming, and a low-latency soundboard.

## Development

```bash
npm install
npm run dev
```

Generate a demo Pro license key:

```bash
npm run license:demo
```

Activate the key in **Settings → License**.

## Build the Windows installer (.exe)

```bash
npm run package
```

The NSIS installer is written to `release/SlipUpClipz Setup 0.1.0.exe`.

Unpack without installer:

```bash
npm run package:dir
```

## Marketing website

Static site source lives in `website/`. Build a deployable copy:

```bash
npm run website:build
```

Output: `dist-website/`

## Features

### Core
- Rolling replay buffer (0–30s) with MediaRecorder
- Waveform trim editor with preview
- Clip library with playback

### Soundboard
- Manual 4×3 pad grid
- Overlapping Web Audio playback with pre-decoded buffers
- In-app hotkeys (free) and **global Windows hotkeys** (Pro)

### Pro
- VB-Audio Virtual Cable output routing via `AudioContext.setSinkId`
- Auto-start with Windows (`app.setLoginItemSettings`)
- All 12 soundboard pads (free tier: 3 pads)
- License activation in Settings

## Tech stack

- Electron, React, TypeScript, Vite, Tailwind CSS
- electron-builder (NSIS installer)
- electron-store (settings + license persistence)
