# SlipUpClipz Pro Purchasing

Phase 5 commerce setup for Stripe Checkout, affiliate codes, license delivery, and subscription renewals.

## Endpoints

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/.netlify/functions/create-checkout` | POST | Creates a Stripe Checkout session and returns `{ url }` |
| `/.netlify/functions/stripe-webhook` | POST | Verifies Stripe webhooks, issues licenses, sends email, tracks affiliates |
| `/.netlify/functions/validate-license` | POST | Server-side license validation for Electron (no client secrets) |
| `/.netlify/functions/billing-portal` | POST | Creates a short-lived Stripe Customer Portal session on demand |

### `create-checkout` request body

```json
{
  "affiliateCode": "YOURCODE"
}
```

`affiliateCode` is optional. Invalid or inactive codes return `400`.

### `validate-license` request body

```json
{
  "licenseKey": "SLIP-XXXX-XXXX-XXXX"
}
```

Response (minimum activation result):

```json
{
  "valid": true,
  "tier": "pro",
  "expiresAt": "2027-07-16T00:00:00.000Z"
}
```

### `billing-portal` request body

```json
{
  "licenseKey": "SLIP-XXXX-XXXX-XXXX",
  "email": "customer@example.com"
}
```

Returns `{ "url": "https://billing.stripe.com/..." }`. Portal URLs are single-use and short-lived. They are never emailed.

## Environment variables

Set these in Netlify (Site settings → Environment variables). Do not commit secrets.

| Variable | Required | Description |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key. Use `sk_test_...` until launch. |
| `STRIPE_WEBHOOK_SECRET` | Yes | Signing secret from your Stripe webhook endpoint (`whsec_...`). |
| `STRIPE_PRICE_ID` | Yes | Annual Pro price ID (`price_...`) for $4.99/year recurring. |
| `STRIPE_AFFILIATE_COUPON_ID` | When affiliates launch | Shared **25% off, duration: once** coupon for first invoice only. |
| `RESEND_API_KEY` | Yes | Resend API key for license delivery email. |
| `RESEND_FROM_EMAIL` | Yes | Verified sender on `slipupclipz.com`, e.g. `SlipUpClipz <orders@slipupclipz.com>`. |
| `SITE_URL` | Yes | Public site URL, e.g. `https://slipupclipz.com`. |
| `SUPPORT_EMAIL` | Optional | Reply-To/support address. Defaults to `slipupclipz@gmail.com`. |
| `REFUND_WINDOW_DAYS` | Optional | Days before pending affiliate commission can be approved. Defaults to `14`. |
| `COMMERCE_STORE_NAME` | Optional | Netlify Blobs store name. Defaults to `slipupclipz-commerce`. |

There is **no** `LICENSE_SECRET` and no shared signing secret in the Electron app.

## Stripe Test Mode setup

1. Create a **Product** in Stripe Test Mode: `SlipUpClipz Pro`.
2. Add a **Price**: `$4.99 USD`, recurring **yearly**. Copy the `price_...` ID into `STRIPE_PRICE_ID`.
3. Create a **Coupon**: `25% off`, duration **once** (first invoice only). Copy the coupon ID into `STRIPE_AFFILIATE_COUPON_ID`.
4. Enable the **Customer Portal** in Stripe settings.
5. Add a webhook endpoint pointing to:
   ```
   https://<your-site>/.netlify/functions/stripe-webhook
   ```
   Events to subscribe:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `charge.refunded`
   - `charge.dispute.created`
   - `charge.dispute.closed`
6. Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.
7. Set `STRIPE_SECRET_KEY` to your test secret key (`sk_test_...`).

Local webhook testing:

```bash
stripe listen --forward-to http://localhost:8888/.netlify/functions/stripe-webhook
```

Use the signing secret printed by the Stripe CLI for local `STRIPE_WEBHOOK_SECRET`.

## Switching Stripe from Test to Live

1. In Stripe Dashboard, switch to **Live** mode.
2. Recreate the product, yearly price, **once-duration** affiliate coupon, customer portal settings, and webhook endpoint against your production URL.
3. Replace Netlify environment variables with live values.
4. Redeploy the site.
5. Run one live test purchase and confirm license email + webhook processing.

No code changes are required to go live — only Stripe dashboard objects and environment variables.

## Affiliate rules (initial launch)

Creators are defined in `netlify/data/affiliates.json`. The shipped file starts empty — add real creators before launch.

```json
{
  "code": "YOURCODE",
  "creatorName": "Creator Name",
  "commissionPercent": 25,
  "customerDiscountPercent": 25,
  "stripeCouponId": "",
  "active": true
}
```

### Discount duration

- **Customer discount:** 25% off the **first year only**
- Stripe coupon must use **duration: once** (first invoice only)
- Renewals bill full price

### Commission rules

- **Creator commission:** 25% of the **first amount actually paid**, excluding tax
- **No recurring creator commission** on renewals
- Refunds, disputes, and chargebacks revoke or reduce the related commission
- Creator earnings remain **pending** until `REFUND_WINDOW_DAYS` (default 14) have passed
- After the refund window, commission moves from pending to approved in storage
- **Payouts are not automatic** — approval only marks eligibility for manual payout

Example at $4.99/year with 25% off first year:

```
Retail subtotal   $4.99
Coupon (once)     −25%
Paid (ex tax)     $3.74
Creator earns     25% × $3.74 = $0.94 (pending 14 days)
Year 2 renewal    full price, $0 creator commission
```

### Runtime stats (admin-ready)

Netlify Blobs records:

- `stripe-event:{EVENT_ID}` — webhook idempotency (every processed event)
- `affiliate-stats:{CODE}` — pending/approved/revoked commission totals
- `affiliate-commission:{ID}` — individual commission records
- `license:{KEY}` — license, email, affiliate, payment IDs, subscription status, renewals
- `customer:{stripeCustomerId}` — lookup by Stripe customer
- `subscription:{stripeSubscriptionId}` — lookup for renewals
- `charge:{chargeId}` / `payment-intent:{id}` — refund/dispute lookup

## License delivery

After successful checkout:

1. Webhook verifies the Stripe signature against the **raw request body**.
2. Duplicate Stripe event IDs are ignored.
3. If a license already exists for the subscription, no second license or email is issued.
4. A unique `SLIP-XXXX-XXXX-XXXX` key is generated with cryptographically secure randomness.
5. The license record is stored in **Netlify Blobs** (required in production).
6. Resend emails the license key from a verified `slipupclipz.com` sender with Reply-To `slipupclipz@gmail.com`.
7. Yearly renewals keep the **same license key** and update expiration on renewal invoices.

## License validation architecture

- Electron must **not** embed a shared signing secret.
- Electron should call `/.netlify/functions/validate-license` with the license key.
- The server checks the stored license record and live Stripe subscription status.
- Only `{ valid, tier, expiresAt }` is returned.

See `docs/ELECTRON_LICENSE.md` for the planned Electron connection (UI not changed yet).

## Storage safety

- **Production:** Netlify Blobs is required. Functions throw if Blobs is unavailable.
- **Local dev (`netlify dev`):** Falls back to `.netlify/commerce-dev/` with `_storeEnvironment: "dev-local"` on every record.
- Local dev data can never be used in production — production never reads the file fallback.

## Email

- **From:** `RESEND_FROM_EMAIL` on a verified `slipupclipz.com` domain
- **Reply-To:** `slipupclipz@gmail.com` (or `SUPPORT_EMAIL`)
- Do **not** send from `@gmail.com` through Resend
- Do **not** email permanent billing portal URLs

## Local development

```bash
npm run website:netlify-dev
```

Do not deploy until Stripe, Resend, and Netlify env vars are configured.
