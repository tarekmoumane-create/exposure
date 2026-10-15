# Look science: what physically makes each look, and how Exposure reproduces it

Written 15 Oct 2026 from web research, Boothie's reference frames (`research/reference/boothie-looks/`,
measured with sharp at 512 px) and how the real cameras, stocks and lights behave. This is the source of
truth for the numbers in `server/lib/render/recipes.ts` and the prompts in `server/lib/relight.ts`.

## The pipeline (why there are two halves)

A look is two separable things:

1. **The light**: where it comes from, how it falls off, what it does to shadows, highlights, the sky and
   existing lamps. Changing it needs an understanding of the scene, so it is done by the image model with a
   prompt that asks for exactly that and nothing else. The result is accepted only if its structure matches
   the input (frame aligned, no new edges), and then every fine detail is taken back from the original pixels
   (`detailLock`), so the model can only have changed brightness and colour at large scale.
2. **The rendering**: tone curve, colour science, grain, optics, resolution and compression of the camera or
   film. These are measurable pixel properties, so they are done deterministically in code. They never add
   content, work on any photo, and are the same for a face, a landscape or a screenshot.

Looks that only change rendering (35mm Film, Haze) never call the model.

## Measurements of Boothie's reference frames

Values at 512 px: mean luminance, luminance std (contrast), 1st / 99th percentile (black and white points),
mean saturation, mean RGB of shadows (L<60) and highlights (L>190), high-pass std (noise).

| Frame | mean | std | p1 | p99 | sat | shadow RGB | highlight RGB | noise |
|---|---|---|---|---|---|---|---|---|
| golden_hour_before | 123 | 55 | 10 | 220 | 0.23 | 39/41/30 | 184/203/220 | 7.9 |
| golden_hour_after | 127 | 51 | 24 | 223 | 0.40 | 52/44/21 | 206/206/198 | 7.5 |
| red_flash_before | 120 | 50 | 6 | 215 | 0.24 | 27/30/38 | 192/207/217 | 10.2 |
| red_flash_after | 70 | 33 | 8 | 144 | 0.41 | 33/37/29 | 198/189/180 | 6.7 |
| flash_dark_after | 80 | 67 | 1 | 237 | 0.52 | 13/34/28 | 234/217/177 | 7.9 |
| canon_g7x_after (night) | 68 | 62 | 1 | 225 | 0.54 | 34/20/10 | 228/209/195 | 8.1 |
| flash_daylight_after | 143 | 68 | 18 | 255 | 0.30 | 51/38/35 | 243/225/199 | 12.1 |
| y2k_digicam_after | 102 | 68 | 7 | 242 | 0.38 | 22/30/25 | 220/211/207 | 15.4 |
| warm_vintage_after | 134 | 39 | 34 | 219 | 0.19 | 59/39/28 | 231/202/176 | 6.6 |
| stardust_after | 137 | 71 | 14 | 231 | 0.46 | 47/34/18 | 235/212/175 | 5.0 |
| macbook_after | 66 | 62 | 0 | 254 | 0.39 | 28/21/22 | 245/234/204 | 5.6 |

What the pairs say:

- **Golden hour** keeps overall brightness, lifts blacks (+14), nearly doubles saturation, turns neutral/blue
  shadows warm and blue highlights neutral-warm, and lowers contrast a little. Noise unchanged.
- **Red flash** drops nearly a stop, compresses highlights hard (p99 215 → 144), roughly doubles saturation
  and lowers contrast (std 50 → 33). It is a flat, muted, red-dominated image, not a bright one.
- **Night flash** crushes blacks to 0, keeps highlights below clipping, has strongly green-cyan shadows
  (R 13 vs G 34) and warm yellow highlights. Saturation is high.
- **Y2K digicam** has double the noise of any other frame, slightly green shadows, blacks near 7 and
  highlights near clipping.
- **Warm vintage (film)** has the lowest contrast and saturation, blacks lifted to 34, warm everywhere.

## Per-look physics and parameters

### 35mm Film (Kodak Gold 200 character)
Sources: Kodak PGI 44 for 35 mm Gold (grain is clearly visible); reviews describe warm yellow-leaning
colour, peach skin, olive-yellow foliage, "warmth mixed with green", gentle organic highlight roll-off,
less fine detail than Portra. Halation: light passes the emulsion, reflects off the base and re-exposes the
red-sensitive layer, giving red-orange halos that go orange at the overexposed core.

Rendering: black 0.045, white 0.965, contrast 1.04, shoulder from 0.72; greens hue −14° and sat 0.84; blues
hue −10°; skin sat 1.08; shadows faint green-teal, highlights warm cream; gain R 1.03 / B 0.955; sat 0.94 +
vibrance 0.12; softness 0.05% of the long edge; CA 0.0012; halation threshold 0.82, radius 1.2%, colour
(1, 0.38, 0.12), amount 0.28; grain 0.055 at 1.7 px with 65% highlight protection and 30% chroma;
vignette 0.16. No model call.

### Y2K Compact (early-2000s 3 MP CCD, flash)
Sources: the look is the whole chain (small CCD, cheap lens, direct flash, in-camera colour, JPEG). In-camera
sharpening is applied at the JPEG stage on nearly every compact and was overdone on low-end ones, giving
bright/dark halos (Imatest, patents). CCD compacts clip highlights and lean cool-magenta.

Relight (model): built-in flash from the lens, ambient and sky unchanged, near things +½ stop and flat with
hotspots, hard thin shadow behind, distant scenery unchanged, slightly cool white balance.
Rendering: noise 0.045 per-pixel with shadow boost 1.3 and 55% chroma speckle (before compression, like a
sensor); gain R 1.02 / G 0.985 / B 1.035; black 0.02, contrast 1.14, +0.05 EV, hard clip; sat 1.15 with
blues 1.15; real JPEG round trip at 50% scale, quality 70 (block structure, chroma smear); unsharp 0.08%
radius at 1.15 (halos); CA 0.0025; vignette 0.22.

### Point & Shoot (modern 1-inch compact, daylight fill flash)
Sources: the G7X "flash + film" trend. What people describe: bright skin from direct flash, subject
separated from a slightly darker background, clean whites, rich colour, slight softness, "crisp pop".
Grain is not part of it. f/1.8 lens, fast shutter.

Relight: daylight stays, flash fills what is within a few metres (+½ stop, flat, specular hotspots on skin,
eyes, lips, wet and glossy surfaces), faint hard shadow behind near objects, far objects unchanged.
Rendering: contrast 1.12, clip, gain B 1.02 (slightly cool), sat 1.14, blues/reds +, unsharp 0.06% at 0.55,
noise 0.018 in shadows, vignette 0.12.

### After Dark (compact flash at night)
Sources: inverse-square falloff (two stops per doubling of distance) is why direct flash isolates the
subject against a black background; on-camera flash casts a hard shadow onto whatever is right behind and
produces red-eye and specular hotspots; nothing beyond a few metres is lit. Boothie's frame: blacks at 0,
green-cyan shadows, warm highlights, strong vignette.

Relight: night, only light is the lens flash; sky dark; existing lamps on and warm; near things bright and
flat with hotspots; mid dim; far near-black except its own lights; hard thin shadow behind; flash white
balance so tungsten is orange. For photos without a near subject: exposure and colour only.
Rendering: contrast 1.18 with a toe, clip; shadows (−0.03, +0.02, +0.025) cyan-green, highlights warm;
sat 1.08; unsharp 0.5; noise 0.04 with shadow boost 1.5 and 40% chroma; vignette 0.38.

### Rouge (red-gel flash)
Relight: night, only light is a flash with a saturated red gel; what it reaches is washed in red with red-pink
hotspots; what it does not reach is deep teal-blue; hard shadow behind; falloff with distance.
Rendering (from the measured frame: dark, flat, highlights compressed): black 0.035, white 0.86, contrast
0.95, shoulder from 0.6; shadows teal, highlights red; reds sat 1.15; grain 0.05 at 1.5 px; vignette 0.32.

### Paparazzi (press flash at night)
Relight: powerful flash from the lens, near things slightly overexposed toward white with strong speculars,
background near black with only its own small sharp lights, hard black shadow, cool neutral white balance.
Rendering: contrast 1.3 with a toe, +0.1 EV, clip; slightly cool; sat 0.95; unsharp 0.6; noise 0.035;
vignette 0.25.

### Golden Hour
Sources: sun within ~6° of the horizon, 2000–3000 K (vs 5500 K daylight), near-horizontal light that wraps
gently, long shadows, sharply defined under clear sky, saturated colour; warm haze toward the sun.

Relight: sun ~5° up, amber ~2800 K, side and slightly behind on the side that agrees with existing shadows;
lit faces warm and bright, away faces soft cool shadow; thin warm rim light on sun-facing edges; long
soft-edged ground shadows; sky warm at the horizon to pale blue above, clouds lit from below; faint warm haze;
nothing moves.
Rendering (from the pair): black 0.04, white 0.975, contrast 0.98, shoulder 0.8; warm shadows and highlights;
greens −12° toward gold; skin sat 1.08; sat 1.08 + vibrance 0.1; warm sun bloom threshold 0.78 radius 3%
amount 0.18; faint halation; grain 0.022 at 1.5 px; vignette 0.08.

### Blue Hour
Sources: sun 4–8° below the horizon, light fully diffuse, no hard shadows, 6000–9000 K blue ambient, artificial
lights balance against the sky; fast lens, high ISO.

Relight: twenty minutes after sunset, −2 EV, all ambient cool blue, sky deep blue-indigo, every existing lamp,
window, sign, headlight and screen on and warm with soft halos; a warm lamp just outside the frame on a near
subject if no lamp is visible; no hard shadows.
Rendering: black 0.03, white 0.95, contrast 0.96, −0.1 EV; blue shadows, warm highlights; warm halos on lights
threshold 0.8 radius 1.2% amount 0.22; grain 0.045 at 1.2 px with chroma; vignette 0.2.

### Window Light
Relight: one large soft window to one side (the side that agrees with the existing light), bright wrap-around
falloff into gentle shadow, soft rectangular catchlights, background a little darker and quieter, neutral
slightly warm, no sun, no flash.
Rendering: black 0.02, white 0.985, contrast 0.96, shoulder 0.85; gain R 1.015 / B 0.985; sat 0.98; softness
0.04% at 0.4; grain 0.015; vignette 0.05.

### Haze (backlit warm haze, old lens)
Sources: bloom is neutral light diffusion, halation is the warm red-orange halo, both appear together;
cross-screen / dirty-lens flares are four-point streaks on point sources only.
Rendering only: gain R 1.04 / B 0.93; uniform haze toward (1, 0.9, 0.72) at 10%; black 0.06, contrast 0.9,
shoulder 0.8; bloom threshold 0.78 radius 3% amount 0.35 (screen blend, so bright areas cannot blow out);
star flares on point highlights only (mask minus its wide blur), threshold 0.9, length 7%; halation 0.2;
sat 0.95 + vibrance 0.1; grain 0.035 at 1.6 px; vignette 0.1.

### Bedroom Webcam (2010 MacBook iSight, Photo Booth)
Sources: iSight output was 640×480, cheap optics, "cheap electronics add noise, especially in low light, or
weird colour shifts", any light source "way over-exposed", soft fuzzy image, warm cast from auto white balance
under lamp light.

Relight: night indoors, daylight gone, warm bedside lamp to one side plus pale laptop-screen glow from the
camera position on whatever is near; warm orange-pink ambient, dim background, soft blown highlights near the
lamp.
Rendering: video noise 0.07 per-pixel with shadow boost 1.5 and 60% chroma; gain R 1.06 / B 0.94; black 0.05,
white 0.97, contrast 0.88, +0.08 EV; slight green shadows and magenta highlights; sat 0.9; JPEG round trip at
42% scale quality 62; softness 0.08% at 0.5; vignette 0.25.

### Booth Strip
Generative by design (four frames from one photo), so it keeps a format prompt and skips verification. Print
rendering: sat 0.55, warm sepia gains, contrast 1.06, grain 0.045 at 1.8 px, vignette 0.3.

## Verification and the detail lock

At 320 px: strong edges are the top 8% of Sobel magnitudes with an absolute floor.
- `aligned`: mean cos(2Δθ) of gradient orientation at the original's strong edges where the candidate also
  has an edge. Aligned frames score 0.8–1.0 (measured 0.77–0.89 on accepted golden hour results); a shift,
  zoom or outpaint scores near 0. Threshold 0.6.
- `added`: share of the candidate's strong edges that have no original edge within 1% of the long edge.
  Catches new objects, people, text. Threshold 0.35.
- Legitimate edge loss (a night conversion drops shadow detail) does not lower either score.
A rejected candidate is retried once with a stricter prompt and high thinking; a second rejection uses the
deterministic fallback relight so the user always gets a photo, never a stranger.

Detail lock: `out = relit + amount × (detail(original) − detail(relit))`, detail = image − Gaussian(1.2% of
the long edge). Amount 0.9 for flash looks and 0.85 for soft light. The model's large-scale light survives;
every edge, texture, pore and letter is the original's.

Flat inputs (mean edge magnitude < 0.004) skip the model: there is nothing to relight.

## Sources
- Kodak Gold 200: dehancer.com/learn, 50mmf2.com, culturedkiwi.com, brooklynfilmcamera.com, thedarkroom.com
- CCD / digicam look: vintagecamerahut.com, throwback.now, adaminsights.com
- In-camera sharpening halos: imatest.com/docs/sharpening, US patents 8736722 and 7809208
- Direct flash physics: neilvn.com (inverse square), shutterbug.com (on-camera flash shadows, red-eye)
- Halation: analog.cafe, blog.dehancer.com/halation, vsco.co/learn (halation vs bloom), discuss.pixls.us
- Golden / blue hour: photographytalk.com, alza.cz guide
- iSight / Photo Booth: discussions.apple.com threads, shotkit.com/mac-camera
- G7X flash look: loumarkspresets.com, hoodfair.com
- Film grain models: Newson et al. (IPOL 2017), Zhang et al. (TOG 2023)
