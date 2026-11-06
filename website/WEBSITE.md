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

## v0.1.6 local preview

The public installer is still v0.1.5. Do not deploy this site, point downloads at a v0.1.6 file, or publish a release until that installer exists. `npm run website:dev` serves the preview at http://localhost:5174 and answers the survey and checkout functions locally. Download buttons still use `/.netlify/functions/download-latest`.

## Survey feedback

Local responses are stored in `.netlify/feedback-dev/`, which is gitignored. Review them with:

```bat
node scripts/export-survey-feedback.mjs
```

That writes `.netlify/feedback-export.json` and prints counts for how people heard about SlipUpClipz and where they found the download. It does not publish the responses.

On Netlify, the same records belong in the private Blobs store `slipupclipz-feedback`. Read them with a server-only token:

```bat
curl -H "x-survey-admin-token: YOUR_TOKEN" https://slipupclipz.com/.netlify/functions/survey-export
```

Set `SURVEY_ADMIN_TOKEN` in the Netlify environment. Do not put that token in the website code. There is no public admin page.

## Stripe promotion code SURVEY20

SURVEY20 is the Stripe promotion code for the survey thank-you. The public website must not display that code until a visitor submits the survey and clicks the claim button. Checkout still accepts the code if someone types it: regular checkout sets `allow_promotion_codes`, and Continue to Checkout applies this one promotion code without also allowing a second code. The coupon is `amount_off: 100`, `currency: usd`, and `duration: once`. Completing the survey is not checked again on the server.

Create the live coupon and the SURVEY20 promotion code in Stripe only after approval. Then set `STRIPE_INTRO_COUPON_ID` and `STRIPE_SURVEY_PROMOTION_CODE_ID`. This repo does not create those live objects. A test-mode key can create the test coupon and SURVEY20 automatically. Check the configured price without changing it:

```bat
node scripts/verify-intro-discount.mjs
```

The script refuses to create a coupon when `STRIPE_SECRET_KEY` is a live key.
