# Launch manual gates — August 3, 2026

The repository-side launch work is covered by the automated release checks. These items still require credentials, a store console, a deployment, or real people and must not be faked in code.

## Deploy the catalog and link routing

- Deploy the backend so migration `20260804010000_activity_catalog_v2` runs. It preserves old activities as inactive and inserts the 41 new active activities.
- Deploy `landing/` so `https://www.theovalapp.com/.well-known/assetlinks.json` proxies to the API.
- Confirm the API returns exactly 41 active activities in `sortOrder` order from an authenticated account.

## Finish Android App Links

1. Build the first production AAB for package `com.theovalapp.app` and upload it to the Play internal track.
2. In Play Console, copy the **App signing key certificate** SHA-256 fingerprint—not the upload-key fingerprint.
3. Set backend production env `ANDROID_SHA256_CERT_FINGERPRINT` to the colon-delimited fingerprint and redeploy.
4. Confirm both association URLs contain `com.theovalapp.app` and the non-empty fingerprint:
   - `https://api.theovalapp.com/.well-known/assetlinks.json`
   - `https://www.theovalapp.com/.well-known/assetlinks.json`
5. On a physical Android device with the internal-track build, open a real `/pod/:id`, `/clubs/:id`, and `/users/:id` web link and confirm each opens Oval directly.

## Enable release crash reporting

- Add `EXPO_PUBLIC_SENTRY_DSN` to the EAS production environment.
- Add the Sentry organization, project, and auth-token build secrets, then remove `SENTRY_DISABLE_AUTO_UPLOAD=true` from the production EAS profile so release sourcemaps upload.
- Force one test exception in a non-production build and confirm it arrives with the correct environment and readable stack trace before submission.

## Put real supply in the app

- Recruit and verify the ambassador accounts that will own launch pods.
- Set `SEED_AMBASSADOR_EMAILS` and run `npm run seed:launch --prefix backend` against the verified production database. The script is idempotent and now creates specific pod titles under the generalized activities.
- Confirm upcoming pods and club meetings are real, staffed, and still scheduled. Do not use screenshot/demo users as launch supply.

## Store and device checks

- Create a production Android build after the version, permission, and package changes; the July preview build used the retired package and is not a release candidate.
- Complete Play Data Safety/App Access using the live privacy policy and a working pre-verified reviewer account.
- Upload the Play feature graphic and current phone screenshots.
- Test sign-up, reviewer bypass, location, photo picking, push permission/delivery, pod creation/join/chat, club flows, report/block, data export, and account deletion on current physical iOS and Android devices.
- Run `npm run release:check` under Node 22 immediately before each store build.
