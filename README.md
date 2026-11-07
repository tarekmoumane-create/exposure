# Exposure

Your camera roll as a roll of film. Choose one stock and up to 12 photos; Exposure develops them as a set, with a contact sheet, and can mail them as real prints.

## Run

```bash
npm install
npx expo start
npx expo lint
npx tsc --noEmit
cd server && npx tsx scripts/ledger-test.ts && npx tsx scripts/prints-test.ts
```

Web preview with a phone frame: http://localhost:8081/phone.html. Move `.env.local` aside while previewing to run simulated (no calls to the live API).

## How it works

- **Rolls** (`src/app/(tabs)/index.tsx`, `src/app/new-roll.tsx`, `src/app/roll/[id].tsx`): one stock, up to 12 frames, all on this phone.
- **Developer** (`src/components/developer.tsx`): works through waiting frames. The first runs alone, the rest run three at a time with it as the match frame. A frame only starts if a photo can pay for it.
- **Engine** (`server/lib/pipeline.ts`): the model renders each frame; the verifier rejects shifted content or invented borders, then retries or falls back. `server/scripts/roll.ts` develops a folder the same way.
- **Frame viewer** (`src/app/frame.tsx`): swipe, hold for the original, set strength.
- **Sample roll** (`src/data/sample-roll.ts`): a real developed roll bundled in the app, no AI call.
- **Credits**: one free frame per device (keychain id, capped by `FREE_DAILY_CAP`), then plans and packs. `server/lib/ledger.ts` decides.
- **Prints** (`server/lib/prints.ts`, `src/lib/prints.ts`): frames upload, Stripe Checkout takes payment and address, the webhook sends the order to Prodigi. Hidden until `/api/prints/config` reports enabled.

## Turning prints on

Vercel env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PRODIGI_API_KEY`; `PRODIGI_ENV=live` when ready. Optional: `PRODIGI_SKU`, `PRINT_PRICE_CENTS`, `PRINT_SHIPPING_CENTS`, `PRINT_COUNTRY`, `STRIPE_AUTOMATIC_TAX=on`.
Stripe webhook URL: `https://exposure-api.vercel.app/api/prints/webhook`, events `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
Prints refuse to run with `sk_test` Stripe keys and `PRODIGI_ENV=live` together, because test payments would create real orders. Sandbox Prodigi is the default.

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
