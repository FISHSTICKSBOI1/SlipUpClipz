import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'public',
  'images',
  'screenshots',
)
mkdirSync(dir, { recursive: true })

function frame(title, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720" role="img" aria-label="${title}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b0e16"/>
      <stop offset="100%" stop-color="#141826"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#7c5cff"/>
      <stop offset="100%" stop-color="#e879f9"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="720" rx="28" fill="url(#bg)"/>
  <rect x="24" y="24" width="1232" height="672" rx="22" fill="#10131c" stroke="#2a3148"/>
  <circle cx="56" cy="56" r="7" fill="#fb7185"/>
  <circle cx="80" cy="56" r="7" fill="#fcd34d"/>
  <circle cx="104" cy="56" r="7" fill="#34d399"/>
  <text x="130" y="62" fill="#94a3b8" font-family="Segoe UI, Arial, sans-serif" font-size="18">SlipUpClipz · ${title}</text>
  ${body}
</svg>`
}

function waves(x, y, w, h, activeStart = 0.25, activeEnd = 0.7) {
  const n = 48
  let bars = ''
  for (let i = 0; i < n; i += 1) {
    const t = i / (n - 1)
    const bh = 18 + ((i * 17) % (h - 24))
    const active = t >= activeStart && t <= activeEnd
    const bx = x + i * (w / n)
    bars += `<rect x="${bx.toFixed(1)}" y="${(y + h - bh).toFixed(1)}" width="${(w / n - 3).toFixed(1)}" height="${bh}" rx="2" fill="${active ? 'url(#accent)' : '#334155'}"/>`
  }
  return bars
}

const pads = ['LOL', 'No way', 'Clip', 'Bruh', 'GG', 'Wait', 'What', 'Send it', 'Nice', 'Oof', 'Pause', 'Fire']
  .map((label, i) => {
    const col = i % 4
    const row = Math.floor(i / 4)
    const x = 80 + col * 290
    const y = 170 + row * 150
    const active = i === 2
    return `<rect x="${x}" y="${y}" width="270" height="130" rx="18" fill="${active ? '#2a1f4d' : '#161a27'}" stroke="${active ? '#7c5cff' : '#2a3148'}"/><text x="${x + 24}" y="${y + 72}" fill="${active ? '#fff' : '#cbd5e1'}" font-size="24" font-family="Segoe UI, Arial, sans-serif" font-weight="700">${label}</text>`
  })
  .join('')

const files = {
  'clips-page.svg': frame(
    'Clips page',
    `<rect x="48" y="96" width="280" height="520" rx="16" fill="#161a27" stroke="#2a3148"/>
    <text x="72" y="140" fill="#e2e8f0" font-size="22" font-family="Segoe UI, Arial, sans-serif" font-weight="700">Clips</text>
    <rect x="72" y="168" width="220" height="44" rx="10" fill="#1c2233"/>
    <rect x="72" y="232" width="220" height="70" rx="12" fill="#1c2233" stroke="#7c5cff55"/>
    <rect x="72" y="318" width="220" height="70" rx="12" fill="#1c2233"/>
    <rect x="72" y="404" width="220" height="70" rx="12" fill="#1c2233"/>
    <rect x="360" y="96" width="848" height="240" rx="16" fill="#161a27" stroke="#2a3148"/>
    <text x="392" y="140" fill="#94a3b8" font-size="16" font-family="Segoe UI, Arial, sans-serif">Replay buffer</text>
    ${waves(392, 170, 780, 120)}
    <rect x="360" y="360" width="848" height="256" rx="16" fill="#161a27" stroke="#2a3148"/>
    <text x="392" y="404" fill="#94a3b8" font-size="16" font-family="Segoe UI, Arial, sans-serif">Clip library</text>
    <rect x="392" y="430" width="240" height="140" rx="14" fill="#1c2233"/>
    <rect x="656" y="430" width="240" height="140" rx="14" fill="#1c2233"/>
    <rect x="920" y="430" width="240" height="140" rx="14" fill="#1c2233"/>`,
  ),
  'replay-buffer.svg': frame(
    'Replay buffer',
    `<rect x="80" y="140" width="1120" height="420" rx="20" fill="#161a27" stroke="#2a3148"/>
    <text x="120" y="190" fill="#e2e8f0" font-size="28" font-family="Segoe UI, Arial, sans-serif" font-weight="700">Replay buffer · listening</text>
    <circle cx="1120" cy="178" r="8" fill="#34d399"/>
    ${waves(120, 230, 1040, 220, 0.55, 1)}
    <rect x="120" y="480" width="180" height="44" rx="12" fill="url(#accent)"/>
    <text x="175" y="508" fill="white" font-size="18" font-family="Segoe UI, Arial, sans-serif" font-weight="700">Clip</text>`,
  ),
  'trim-editor.svg': frame(
    'Trim editor',
    `<rect x="80" y="140" width="1120" height="420" rx="20" fill="#161a27" stroke="#2a3148"/>
    <text x="120" y="190" fill="#e2e8f0" font-size="28" font-family="Segoe UI, Arial, sans-serif" font-weight="700">Trim · 0:04 – 0:11</text>
    ${waves(120, 230, 1040, 220, 0.28, 0.68)}
    <rect x="120" y="480" width="140" height="44" rx="12" fill="#1c2233" stroke="#2a3148"/>
    <text x="150" y="508" fill="#cbd5e1" font-size="16" font-family="Segoe UI, Arial, sans-serif">Preview</text>
    <rect x="280" y="480" width="140" height="44" rx="12" fill="url(#accent)"/>
    <text x="318" y="508" fill="white" font-size="16" font-family="Segoe UI, Arial, sans-serif" font-weight="700">Save</text>`,
  ),
  'soundboard.svg': frame(
    'Soundboard',
    `<text x="80" y="130" fill="#e2e8f0" font-size="28" font-family="Segoe UI, Arial, sans-serif" font-weight="700">Soundboard</text>${pads}`,
  ),
  'voice-effects.svg': frame(
    'Voice effects',
    `<rect x="80" y="140" width="1120" height="420" rx="20" fill="#161a27" stroke="#2a3148"/>
    <text x="120" y="200" fill="#e2e8f0" font-size="28" font-family="Segoe UI, Arial, sans-serif" font-weight="700">Voice effects</text>
    <rect x="120" y="240" width="220" height="64" rx="32" fill="#1c2233" stroke="#2a3148"/><text x="190" y="280" fill="#cbd5e1" font-size="20" font-family="Segoe UI, Arial, sans-serif" font-weight="700">Deep</text>
    <rect x="370" y="240" width="220" height="64" rx="32" fill="#3b2048" stroke="#e879f9"/><text x="430" y="280" fill="#e879f9" font-size="20" font-family="Segoe UI, Arial, sans-serif" font-weight="700">Squeaky</text>
    <rect x="620" y="240" width="220" height="64" rx="32" fill="#1c2233" stroke="#2a3148"/><text x="685" y="280" fill="#cbd5e1" font-size="20" font-family="Segoe UI, Arial, sans-serif" font-weight="700">Radio</text>
    <rect x="870" y="240" width="220" height="64" rx="32" fill="#1c2233" stroke="#2a3148"/><text x="935" y="280" fill="#cbd5e1" font-size="20" font-family="Segoe UI, Arial, sans-serif" font-weight="700">Robot</text>
    <text x="120" y="370" fill="#94a3b8" font-size="16" font-family="Segoe UI, Arial, sans-serif">Pitch</text>
    <rect x="120" y="390" width="500" height="12" rx="6" fill="#1c2233"/>
    <rect x="120" y="390" width="280" height="12" rx="6" fill="url(#accent)"/>
    <text x="120" y="450" fill="#94a3b8" font-size="16" font-family="Segoe UI, Arial, sans-serif">Bass</text>
    <rect x="120" y="470" width="500" height="12" rx="6" fill="#1c2233"/>
    <rect x="120" y="470" width="210" height="12" rx="6" fill="url(#accent)"/>
    <rect x="700" y="390" width="420" height="92" rx="16" fill="#1c2233" stroke="#2a3148"/>
    <text x="730" y="445" fill="#cbd5e1" font-size="20" font-family="Segoe UI, Arial, sans-serif">Hear Myself · monitoring</text>`,
  ),
  'guided-onboarding.svg': frame(
    'Guided onboarding',
    `<rect x="80" y="140" width="1120" height="420" rx="20" fill="#161a27" stroke="#2a3148"/>
    <rect x="160" y="220" width="960" height="260" rx="18" fill="#0f1320" stroke="#7c5cff66"/>
    <text x="220" y="300" fill="#e2e8f0" font-size="32" font-family="Segoe UI, Arial, sans-serif" font-weight="700">Welcome to SlipUpClipz</text>
    <text x="220" y="350" fill="#94a3b8" font-size="20" font-family="Segoe UI, Arial, sans-serif">A quick tour of Clips, Soundboard, and Settings</text>
    <rect x="220" y="390" width="160" height="48" rx="12" fill="url(#accent)"/>
    <text x="255" y="421" fill="white" font-size="18" font-family="Segoe UI, Arial, sans-serif" font-weight="700">Continue</text>`,
  ),
  'settings.svg': frame(
    'Settings',
    `<rect x="80" y="140" width="360" height="420" rx="18" fill="#161a27" stroke="#2a3148"/>
    <text x="110" y="190" fill="#e2e8f0" font-size="22" font-family="Segoe UI, Arial, sans-serif" font-weight="700">Settings</text>
    <rect x="110" y="230" width="300" height="52" rx="12" fill="#241b45"/><text x="130" y="262" fill="#cbd5e1" font-size="18" font-family="Segoe UI, Arial, sans-serif">Audio output</text>
    <rect x="110" y="300" width="300" height="52" rx="12" fill="#1c2233"/><text x="130" y="332" fill="#cbd5e1" font-size="18" font-family="Segoe UI, Arial, sans-serif">Updates</text>
    <rect x="110" y="370" width="300" height="52" rx="12" fill="#1c2233"/><text x="130" y="402" fill="#cbd5e1" font-size="18" font-family="Segoe UI, Arial, sans-serif">Help &amp; Support</text>
    <rect x="110" y="440" width="300" height="52" rx="12" fill="#1c2233"/><text x="130" y="472" fill="#cbd5e1" font-size="18" font-family="Segoe UI, Arial, sans-serif">License</text>
    <rect x="480" y="140" width="720" height="420" rx="18" fill="#161a27" stroke="#2a3148"/>
    <text x="520" y="200" fill="#e2e8f0" font-size="24" font-family="Segoe UI, Arial, sans-serif" font-weight="700">Virtual microphone routing</text>
    <text x="520" y="250" fill="#94a3b8" font-size="18" font-family="Segoe UI, Arial, sans-serif">Output device</text>
    <rect x="520" y="270" width="640" height="56" rx="12" fill="#1c2233" stroke="#2a3148"/>
    <text x="540" y="305" fill="#cbd5e1" font-size="18" font-family="Segoe UI, Arial, sans-serif">CABLE Input (VB-Audio Virtual Cable)</text>`,
  ),
  'demo-poster.svg': frame(
    'Demo poster',
    `<rect x="80" y="140" width="1120" height="420" rx="20" fill="#161a27" stroke="#2a3148"/>
    ${waves(140, 220, 1000, 180, 0.2, 0.85)}
    <circle cx="640" cy="350" r="54" fill="url(#accent)"/>
    <polygon points="628,325 668,350 628,375" fill="white"/>
    <text x="640" y="470" text-anchor="middle" fill="#e2e8f0" font-size="28" font-family="Segoe UI, Arial, sans-serif" font-weight="700">See SlipUpClipz in action</text>`,
  ),
}

for (const [name, svg] of Object.entries(files)) {
  writeFileSync(path.join(dir, name), svg)
  console.log('wrote', name)
}
