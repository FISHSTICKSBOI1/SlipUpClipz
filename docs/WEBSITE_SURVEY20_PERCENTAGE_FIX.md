# SURVEY20 percentage compatibility follow-up

## Evidence and production status

The operator confirms the percentage error appeared at https://slipupclipz.com/pricing#feedback, not a PR preview, and confirms the survey answer exists in production Blobs. No private answers were retrieved or printed.

GitHub API independently confirms PR #2 is merged/closed: merged at 2026-11-12T06:14:16Z (November 11, 10:14 PM Pacific), merge commit/current main `96dc06f5e2cdd2fb94d77d36c6775d2189e9b44d`. Its checkout resolver rejects any non-null percent_off, producing the reported message. The source is verified; the actual live Netlify deployment commit is not independently identifiable from public responses (homepage HTTP 200, Netlify server; no GitHub status/check-run deployment evidence). Operator can confirm the current Published deploy's commit in Netlify without changing it.

The reported error implies a non-null percentage reached the validator. It does not establish 20%, current product eligibility, or all promotion restrictions. No authenticated Stripe account access is available; no live Stripe read, session creation, purchase, coupon edit or deployment was performed. Do not treat a mock as live verification.

## Minimal correction

- Retrieve the configured price from Stripe before discounted checkout. Require active USD 499 cents, annual interval_count 1, licensed/per-unit billing, no quantity transform, correct ID and test/live mode, and no tax-inclusive price that would contradict the advertised before-tax amount.
- Accept either a valid fixed USD 100-cent coupon or exactly 20% (percentage coupons have no currency/amount_off). Both require duration once. Check coupon product restrictions against the configured price product. Active promotion, SURVEY20 name and unambiguous selection checks remain.
- Always send quantity one and only one promotion discount, with no simultaneous allow_promotion_codes. Client-supplied quantity does not control this offer. Regular checkout is unchanged.
- Expand line_items in Stripe's actual Session creation response. Before returning its URL require one matching price/quantity, USD 499-cent subtotal, Stripe-reported 100-cent discount, and 399 cents plus the reported nonnegative tax. Check session and line totals, currency, promotion identity, shipping zero, status and mode. No floating-point percentage calculation is used to authorize the offer.
- Missing/inconsistent Stripe evidence fails closed. Attempt to expire an unverified session; even if expiration fails, withhold its URL and log only a sanitized category. A failed expiration can leave an undisclosed session until Stripe expiration, so this is best-effort cleanup, not a guarantee of immediate deletion.
- Keep the annual price unchanged and coupon duration once: renewal remains $4.99/year before taxes under the existing subscription terms. Stripe remains authoritative for customer restrictions/redemption limits and final checkout eligibility. No promotion is created or changed in live mode. No new environment variable is required for an existing unambiguous eligible promotion.

## Verification

222 tests passed: 112 Netlify/email/storage/checkout, 16 website unit, 57 licensing, 37 Playwright. Production website build and website TypeScript passed; syntax and whitespace checks passed. Tests cover eligible 20% and fixed coupons, wrong percentage/price/currency/product/duration/validity, quantity, ambiguous matches, session rounding/totals, additional discounts, missing evidence, expiration failure, unchanged survey persistence and regular checkout. Browser services are mocked.

The code now verifies Stripe-calculated totals on every discounted request. The actual live SURVEY20 percentage and a real Stripe-calculated Session have NOT been independently verified during this task. Before release, the authorized account holder should inspect existing live promotion/coupon terms read-only (20% once or USD $1 once; applicable Pro product and restrictions). If they differ, do not edit billing; report the mismatch. After a separately authorized release, an operator can open checkout, verify $3.99 before taxes/$4.99 annual renewal, and stop without entering payment details or purchasing. If Stripe returns anything else, the handler must withhold the link.

## Release boundary

The user authorized a follow-up PR after GitHub confirmed #2 was already merged. This follow-up is based on current main; no merge/deploy authorized. Preserve the current successful redesigned Netlify deployment as rollback, and use the existing approval-gated rollback procedure in WEBSITE_SURVEY20_FIX.md. Keep production salt out of previews and do not write survey responses through shared preview storage. No design, installer, Stripe setting, subscription, customer record, webhook, desktop or Cloud AI changes.
