# Private survey storage operations

Reviewed against `submit-survey.cjs`, `feedback-store.cjs`, `storage.cjs`, and `SurveyOffer.tsx` for the SURVEY20 correction.

The website validates survey input and the server reserves a rate slot and awaits saving the response before returning HTTP 200 `{ok:true}`. The UI requires both HTTP success and `ok:true` before showing the offer. Failed/uncertain storage returns an error; no success offer is shown. SURVEY20 remains a public promotion code, not a server-enforced per-person survey entitlement.

Production uses the private, site-wide Netlify Blobs store **`slipupclipz-feedback`**, with answer keys **`response:<opaque-id>`** and rate-limit keys `rate:<salted-hash>`. It is separate from the licensing store. Responses are not emailed by Resend and are not Netlify Forms submissions. Conditional writes confirm successful persistence and prevent retry overwrites; identical submission-ID/network retries deduplicate, not all submissions by the same person.

## View your submitted answer privately

1. Sign in using an authorized team account and select production project **imaginative-blini-4615a3**.
2. Open **Data & storage → Blobs** and select **slipupclipz-feedback**.
3. Inspect the `response:` keys. Open or download the relevant JSON privately and use its saved timestamp to find the submission. Do not modify/delete records or open the licensing store for this task.
4. Do not paste answers into chat, a public PR, screenshots or logs. If downloading, use a private folder outside Git. Confirmation can be reported simply as “record found, timestamp matches,” without sharing answers.
5. If no matching record exists, confirm the correct site and inspect sanitized `submit-survey` Function errors and server-only Blobs context. Keep the existing **SURVEY_IP_SALT** scoped to **Production Functions**, with a deployment that includes it. Do not copy production salt to Deploy Previews or test writes there: this store is site-wide and shared across deployments.

Netlify documents this UI under [Netlify Blobs UI](https://docs.netlify.com/build/data-and-storage/netlify-blobs/#netlify-blobs-ui). Existing authenticated export functionality was not changed or invoked; no public export was added.

## Evidence boundary

The operator now confirms the live survey response was successfully saved in production Netlify Blobs. The reviewed deployed source returns success only after the save path succeeds. Offline tests cover successful persistence, missing salt, storage failure, retries and conditional-write conflicts. The specific live record has **not** been independently inspected in this task. A public pricing quote cannot establish storage or promotion validity. The dashboard instructions above remain available for private operator access; do not repeat the already completed confirmation unnecessarily.
