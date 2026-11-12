# SURVEY20 post-release correction

## Confirmed defect and scope

Based on production main `ad1d6aede478f3ae67ff4bcb8a3ec857e99ae7e9` in the isolated `codex/survey20-live-fix` worktree. The reported exact error is emitted by `resolveIntroCoupon` when the effective `STRIPE_INTRO_COUPON_ID` is empty and the key is live. `resolvePublicPromotionCode` called it before retrieving/listing promotions, so an existing valid SURVEY20 could never be considered. This does not prove that a Stripe coupon is missing. A synthetic live-key regression reproduced 503 instead of 200 before the fix.

The resolver now retrieves the explicit promotion ID, or lists active SURVEY20 promotions, then validates that promotion's actual coupon. It requires confirmed active/valid status, exactly 100 USD cents, no percentage discount, and duration `once`. Multiple active matches require explicit selection rather than guessing. Existing test-only creation remains behind the test-key check; live creation remains prohibited. The installed Stripe SDK uses API `2025-02-24.acacia` and its promotion `coupon` field.

Checkout keeps the existing annual price ID and one promotion-code discount, with no simultaneous `allow_promotion_codes`. Regular checkout still allows manual code redemption. No subscription, price, webhook, affiliate configuration, licensing, UI, installer, or Cloud AI change is included. Stripe remains authoritative for eligibility/restrictions and invoice totals; no purchases were made.

## Production configuration and operator checks

- `STRIPE_SECRET_KEY`: existing server-only live secret/restricted key; preserve it. Its account must allow promotion lookup and Checkout Session creation (coupon retrieval when needed). Never put it in chat or source.
- `STRIPE_PRICE_ID`: existing annual USD 499-cent price ID; preserve it.
- `STRIPE_SURVEY_PROMOTION_CODE_ID`: optional existing Stripe promotion object ID (`promo_...`), **not** the text SURVEY20 and not a coupon ID. Required only to disambiguate active matches or choose an existing promotion explicitly. A configured invalid ID fails rather than silently choosing another.
- `STRIPE_INTRO_COUPON_ID`: a coupon object ID, formerly an unnecessary prerequisite. No longer needed to reuse an existing promotion; still used by the test-only creation fallback. Do not change existing live values merely for this patch.
- `STRIPE_AFFILIATE_COUPON_ID`: separate affiliate setting; not used to resolve SURVEY20. Unchanged.
- `SITE_URL`: preserve the existing production URL.
- `SURVEY_IP_SALT`: existing private Production Functions variable. Keep it out of Deploy Previews; do not submit through previews to the shared production store.

No authenticated Stripe/Netlify configuration access was available for this task. The user previously reported SURVEY20 worked; current live activity and exact coupon terms remain independently unverified. The public pricing endpoint returned HTTP 200, verified live USD annual 499 cents and computed introductory 399 cents. That endpoint does **not** validate promotions.

Before merge, the authorized adult operator should inspect the existing SURVEY20 in the Stripe **live** account: active promotion, associated valid coupon, fixed USD $1.00 off, duration once, applicable to the current Pro product, and any expiry, redemption cap, customer or minimum-spend restrictions. Do not create or edit a coupon. If these terms differ, stop for separate billing authorization. If exactly one correct active promotion exists, this code fix requires no new Netlify variable. If selection is ambiguous, explicitly configure the existing `promo_...` ID in Production Functions only after owner confirmation; do not copy a secret or coupon ID into that setting.

## Verification

- Reproduced original defect before correction; focused discount/survey tests: 28 passed afterward.
- Netlify/email/storage/checkout suite: 106 passed; website unit tests: 16 passed.
- Desktop licensing regressions: 57 passed; desktop source unchanged.
- Production website build, website TypeScript and full TypeScript project checks passed.
- Playwright browser suite: 37 passed (216 total across the four suites). External services are mocked; browser success is not live Stripe redemption evidence.
- No live checkout creation, payment, survey write, email, private response retrieval, or billing/configuration mutation performed.

## Controlled release and rollback

This branch is a PR only; merge/deployment requires the owner's approval. Keep the currently published redesigned deployment ID/permalink as the immediate rollback target (not the earlier pre-redesign deployment). After approval and deployment, inspect the survey-offer checkout subtotal without entering payment details: $3.99 first invoice before applicable taxes, $4.99/year renewal, one discount. Confirm regular checkout remains $4.99/year. Any eligibility error must remain visible rather than showing false success. Creating a live Checkout Session for this check is deferred to the authorized operator; no charge is needed.

Use the existing genuine survey record for private storage confirmation; do not add test responses from Deploy Previews. Follow `WEBSITE_SURVEY_OPERATIONS.md`. Check sanitized Function errors. If checkout regresses, restore the saved previous successful redesigned deployment using Netlify Publish Deploy and verify regular checkout/page health; then prepare a reviewed Git revert so automatic deployment cannot restore the broken change. Never change customer records or coupons as a rollback shortcut.
