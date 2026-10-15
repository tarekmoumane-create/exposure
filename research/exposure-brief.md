# Exposure — product brief

Exposure takes Boothie's proven job-to-be-done and business model, and ships it with its own identity, its own look library, and fixes for Boothie's biggest user complaints. It must **not** read as a Boothie clone (App Store Guideline 4.1 Copycats): different name, icon, palette, typography, copy, look names, screenshot style, and at least three features Boothie does not have.

## 1. Positioning

**Job**: "Rescue the photo you already want to post." One tap turns a flat phone photo into the shot you'd get from a real camera, real light, or a real photobooth, without changing who you are.

**One-liner**: *Exposure. Real-camera looks for your phone photos.*

**Audience**: women 16–34 on TikTok/Instagram, US + UK first, then DE and TR (Boothie's validated markets).

**Promise hierarchy** (what the marketing leads with, in order):
1. Rescue a bad photo (dark dinner, flat vacation, dull Story).
2. Same face, same outfit, same night. Only the camera changes.
3. Results in seconds, no editing skills, no account.

## 2. Feature scope

### Core (parity with Boothie, built our way)
- **Look library** (name the category "Shots", not "Trends"). Launch with 12 looks, grouped:
  - *Flash*: Point-and-shoot (daylight), After Dark (night flash), Rouge (red gel), Paparazzi (hard direct flash).
  - *Light*: Golden Hour, Blue Hour, Window Light, Haze (stardust-style flares).
  - *Era*: Y2K Compact, 35mm Film, Booth Strip (4-up), Bedroom Webcam.
- **One-photo input** from front camera, back camera, or library.
- **Processing screen** with a progress state and an animated reveal (design our own, not Boothie's scan line).
- **Editor after generation**: intensity slider (0–100), film grain, warmth, highlights, optional date stamp.
- **Beauty**: light skin smoothing and eye brightening only. Skip face reshape at launch (slower review, more "not me" complaints).
- **Free on-device mode**: a real photobooth with countdown, 3–4 shot strips, and local Core Image / GPU filters. Keeps the app usable without paying and gives Apple a clear free tier.
- **Gallery** of on-device history. No account, no server storage.

### Differentiators (Exposure's spin; none of these exist in Boothie)
1. **Likeness Lock**: run a face-similarity check (on-device Vision face embedding or an ArcFace model) between input and output. If similarity drops below threshold, auto-regenerate once, then show a "Keep my face" toggle that re-runs with a stronger identity prompt. Directly addresses Boothie's #1 complaint ("this isn't me").
2. **Preview before you pay**: generate a watermarked low-res preview for free (cheap Gemini call or lower quality tier), charge a credit only on "Save full-res". Fixes "everything costs money" and lifts paywall conversion.
3. **Before/After share card**: one-tap export of a split "posted / deleted" image sized for TikTok carousels and Stories, with an optional small "made with Exposure" tag. Turns every user into the persona-account content format.
4. **Variations**: each generation returns 2 candidates for one credit; user picks. Halves the "effect didn't look like Canon" disappointment.
5. **Photo quality coach**: before sending, check blur/brightness/face size on-device and warn ("face too small, results will drift"). Boothie's dev reply to bad reviews was exactly this advice; we build it in.
6. **Credit rollover**: daily credits bank up to 3× the daily amount instead of resetting to zero at midnight. Cheap to offer, kills the "locked out for 22 hours" review.

### Explicitly not building (v1)
Video, multi-person group edits, AI-generated poses that move the body, face reshape, social feed, accounts.

## 3. Monetization

Credits + weekly subs, same engine, friendlier terms.

| SKU | Price | Credits |
|---|---|---|
| Exposure Weekly | $5.99/wk, no trial | 5/day, rollover to 15 |
| Exposure Yearly | $59.99/yr | 10/day, rollover to 30 |
| Packs | 10 / $2.99 · 30 / $6.99 · 80 / $12.99 | never expire, open to all (not subscribers only) |

Free tier: unlimited classic photobooth + local filters; 1 free full-res AI generation at onboarding (first-run "wow"); unlimited watermarked previews.

Paywall copy leads with the before/after of the user's *own* preview, not stock images.

## 4. Tech stack (recommendation)

- **App**: Expo (React Native) + TypeScript. Expo Camera, expo-image-picker, Skia or GL for on-device filters. One codebase for iOS + Android (Boothie shipped Android 3 months late and lost those "is it on Android?" comments).
- **AI**: Google Gemini image model via a server function, same as Boothie, because it is the cheapest route to "edit this exact photo, keep the person". Keep a prompt file per look. Add a second provider adapter (e.g. FLUX Kontext) behind a flag so we are not single-vendor.
- **Backend**: Firebase (Cloud Functions, App Check with App Attest/Play Integrity, Firestore for credit ledger). No photo storage; stream in, stream out.
- **Payments**: RevenueCat (iOS StoreKit 2 + Play Billing). Server-side entitlement check before every generation.
- **Analytics**: PostHog, autocapture off, events: onboarding_done, preview_generated, paywall_viewed, purchase_started, credits_exhausted, save_fullres, share_card_exported, likeness_retry.
- **Crash**: Sentry or Crashlytics.
- **Web**: one-page site on Vercel with the same TikTok in-app-browser escape (`x-safari-https://` on iOS, `intent://` on Android) and a platform-aware download button.
- **Legal**: privacy policy and terms on our own domain, not Notion. Mirror Boothie's strong points: no face templates, no training, transient processing, 13+/16+ ages, DMCA contact.

## 5. Brand direction (must diverge from Boothie)

Boothie is pink, lowercase italic serif, "girly scrapbook". Exposure should feel like a **camera brand**: dark UI, warm off-white type, a single accent (amber/orange like a film box or a flash-ready LED), geometric sans wordmark, shutter/aperture icon. Store screenshots: photo-first, dark background, short headline per frame ("Shot on your phone. Looks like it wasn't.").

## 6. Growth playbook (replicate the mechanics, fix the leaks)

- 6–10 persona accounts, each with a distinct taste, city, and language (EN-US, EN-UK, DE, TR). Different bios and caption banks; no copy-paste between accounts.
- Per look, a 3-post ladder: posted/deleted carousel → "which one?" → 12-second screen-recorded tutorial as a comment reply.
- **Always name the app on the last slide, in the caption, and in a pinned comment** with the exact look and slider value. Boothie loses conversions by gatekeeping.
- Put the link in bio to the Exposure site (with the in-app-browser escape).
- Answer the recurring questions inside the creative: "iPhone + Android", "free preview, pay to save", "no AI label on export".
- Run a "do mine" series: edit viewer-submitted photos on camera.
- Show 0 / 50 / 100% intensity so the "originals look better" crowd sees they control it.
- Hook bank to start from: "my current obsession is adding flash to every pic (tutorial below)", "don't post your Story like this. try this.", "let's give your vacation pics a glow up", "everyone asks which app this is."

## 7. App Store review guardrails

- Original name, icon, wordmark, color system, screenshots, and description copy.
- Different look names and different grouping.
- Free, fully functional on-device mode so the app is not a thin paywall.
- Clear AI disclosure in-app and in the description; consent language for photos of other people.
- Subscription terms in the description (auto-renew, cancel in Settings), Restore Purchases button, privacy nutrition labels matching reality.
- No "Boothie" or competitor names anywhere in metadata or keywords.

## 8. Build order

1. Expo app shell, dark design system, tab bar (Shots · Camera · Library).
2. On-device photobooth + local filters (free tier). Ship TestFlight.
3. Gemini generation function + App Check + credit ledger + RevenueCat.
4. Preview-then-pay flow, intensity editor, share card.
5. Likeness Lock + quality coach.
6. Landing page, legal docs, store assets, persona content library (20 posts banked before launch).
