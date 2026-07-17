# SlipUpClipz website

Marketing and support site for SlipUpClipz (React + TypeScript + Vite + Tailwind).

## Local commands

```bat
cd C:\Users\FISHS\Projects\SlipUpClipz
npm run website:dev
```

Open http://localhost:5174

Production build:

```bat
npm run website:build
npm run website:preview
```

Built files land in `dist-website/`.

## Configuration

Edit one file for URLs and product metadata:

`website/src/config/site.ts`

Desktop Help / Contact links live in:

`shared/externalLinks.ts`

## Beginner deployment (static host)

1. Run `npm run website:build`
2. Upload everything inside `dist-website/` to your host (Netlify, Cloudflare Pages, GitHub Pages, or any static host)
3. Point `slipupclipz.com` at that host
4. Ensure the host serves `index.html` for client-side routes (`/help`, `/download`, etc.)
5. Update `SITE.websiteUrl` and download/purchase placeholders before announcing

Do not publish automatically from this repo without reviewing placeholders first.
