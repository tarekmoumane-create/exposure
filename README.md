# Exposure

Real-camera looks for any photo. Pick a look, add a photo, get it back in seconds with everything in it exactly where it was: only the light and the camera change.
Cream, serif, photo-first, for the same audience as the apps that already print money in this category.

## Run

```bash
npm install
npx expo start            # i / a / w, or scan with Expo Go
npx expo lint
npx tsc --noEmit
```

Web preview with a phone frame: http://localhost:8081/phone.html. Store screenshot generator: http://localhost:8081/store.html.
The camera and Save to Photos need a real device. Everything else runs in Expo Go, a simulator and on web.

## What works today

- **Onboarding**: three before/after slides, then "Try it on your photo": pick a photo, pick a look, and the plan sheet opens over the blurred result right before the first reveal (closing it still reveals the free photo).
- **Looks**: twelve AI looks in three groups, before/after cards, look detail with hold-to-compare, pick from camera or roll.
- **Processing**: real, in two halves (`research/look-science.md` has the measurements and physics). The photo is downscaled to 1536px and posted to the Exposure API (`server/`, a Vercel function). Looks that change the light source (flash, golden hour, blue hour, window, webcam) ask Gemini `gemini-nano-banana-2.1` for a relight only, with a prompt that forbids adding, removing or reframing anything and asks for a clean, unstyled result (`server/lib/relight.ts`). The result is verified against the input (frame alignment at the original's edges, and the share of new edges that were not in the input; `server/lib/render/lock.ts`), retried once with a stricter prompt, and otherwise replaced by a deterministic approximation so a user never gets an invented photo. An accepted relight keeps only its large-scale light: every edge and texture is transferred back from the original pixels (the detail lock). Then the camera or film rendering (tone curve, colour science, grain, halation, optics, resolution, JPEG) is applied in code (`server/lib/render/recipes.ts`), the same on a face, a landscape or a screenshot. 35mm Film and Haze are rendering only and never call the model. Flat inputs skip the model. About 15–25 s and $0.05 per relit photo, under a second for rendering-only looks. A credit is spent only on success; errors show a retry. Without `EXPO_PUBLIC_API_URL` the screen runs a simulated pass.
- **Editor / result**: strength slider (a true cross-fade from the original to the AI result, baked into the export), 17 live filter thumbnails, warmth / brightness / contrast / saturation / grain / vignette, hold-to-compare, Save to Photos and Share. All rendering is on-device: Skia on native, SVG color matrices on web. Export renders at up to 2048px.
- **Studio**: the free photobooth. Four shots on a countdown, filter chips, flash and haptics, then a strip with white or black paper and a date stamp. Save and share the strip. "Roll" edits any photo for free.
- **Gallery**: shots and strips, on this phone only, with live-filtered thumbnails. Files live in the app's document folder and are stored as relative keys, so they survive iOS updates and cache purges; deleting an item deletes its files.
- **Credits**: one free photo on install; plans grant daily photos that refresh at local midnight and bank up to three days; packs never expire; out-of-credits sheet.
- **Purchases**: RevenueCat through `src/lib/purchases.ts`. With `EXPO_PUBLIC_REVENUECAT_IOS_KEY` set, the plan follows the `pro` entitlement and pack credits are granted once per store transaction (so restores and reinstalls reconcile). Without a key, or on web, purchases are mocked locally. Product ids live in `src/data/products.ts`.
- **Paywall, out-of-credits, settings**, toast, haptics, cream app icon and splash.

## Services

| Piece | Where | Config |
|---|---|---|
| Generation API | `server/` → https://exposure-api.vercel.app | Vercel env: `GEMINI_API_KEY`, `APP_TOKEN`; optional `GEMINI_IMAGE_MODEL`, `GEMINI_FALLBACK_MODELS`, `GEMINI_IMAGE_SIZE` (1K/2K/4K), `GEMINI_THINKING_LEVEL` |
| App → API | `src/lib/generate.ts` | `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_APP_TOKEN` (in `.env.local` and EAS env) |
| Purchases | `src/lib/purchases.ts` | `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` |
| Builds | `eas.json` | EAS project `@tarekmoumane-create/exposure` |

Deploy the API with `cd server && npx vercel deploy --prod`. Prompts are in `server/lib/looks.ts` and can be tuned without an app release. Builds: `npx eas-cli build --platform ios --profile production` then `npx eas-cli submit --platform ios --latest` (credentials are on EAS; TestFlight group "Team").

## Not wired yet (needs keys or accounts)

- RevenueCat public keys (the code path is ready; products must also exist in App Store Connect).
- Server-side credit ledger and App Attest. The API currently trusts a shared app token; move to per-device attestation before scale.
- PostHog and Crashlytics.
- Real before/after preview pairs. Current pairs are stock portraits graded offline; swap the files in `assets/images/looks/`.
- Legal pages at a real domain. Drafts are in `legal/` (entity name, address and jurisdiction still placeholders); the paywall and settings link to exposure.app/terms and /privacy, which must be live before review.
- Android RevenueCat key. Without it a release build hides purchases instead of mocking them.

## Layout

```
src/app/            routes
  (tabs)/           studio · index (Looks) · library (Gallery)
  onboarding        first run
  look/[id]         look detail
  choose-look       pick a look after the booth camera
  process           generation progress
  edit              result and editor (also free edits)
  strip             photobooth strip
  paywall, out-of-credits, settings   modals
src/filters/        color matrices, presets, FilteredImage (Skia / web), renderers
src/components/     UI kit
src/store/          app state and credit engine
src/lib/            media (save, share) and navigation helpers
assets/images/looks before/after pairs per look
legal/              privacy policy and terms drafts
research/           Boothie teardown and the Exposure brief
public/             phone.html preview, store.html screenshot generator
```
