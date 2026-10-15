/**
 * Prompts for the relighting stage. The model is asked for exactly one thing: the same
 * photograph under a different light. Everything about rendering (grain, colour science, lens,
 * compression) is done afterwards in code, so the prompt asks for a clean, unstyled result.
 */

export const RELIGHT_RULES =
  'EDIT TASK: you are given one photograph. Return the same photograph with only its lighting changed as described under LIGHT CHANGE.\n\n' +
  'RULES, in priority order:\n' +
  '1. Add nothing and remove nothing. Every person, face, animal, object, sign, text, logo and background element in the input is in the output, in the same place, at the same size and shape. Never add people, faces, hands, objects, lamps, cars, text or decoration that are not in the input. If there is no person, do not create one.\n' +
  '2. Same framing: same crop, same aspect ratio, same zoom, same orientation. Nothing is extended beyond the edges of the input and nothing is cut off.\n' +
  '3. Same identity: when there are people, keep face shape, features, skin tone, skin texture, expression, apparent age, hair, body shape, pose, hands and clothing exactly. No beautifying, smoothing, slimming, reshaping or retouching.\n' +
  '4. Same geometry: every edge and outline in the output lines up with the input pixel for pixel.\n' +
  '5. Change only what this light physically changes: brightness, where shadows fall, highlights and specular reflections on existing surfaces, the colour of the light and the white balance, the colour and brightness of the sky, and whether existing lamps, screens and signs are switched on.\n' +
  '6. Render clean: no grain, noise, vignette, film texture, blur, sharpening halos, borders or date stamps. The camera and film rendering is applied later in software.\n' +
  '7. Photos without a clear foreground subject (landscapes, food, interiors, screenshots, documents): light the scene as this light source would really light it. A flash only reaches what is near the camera; distant scenery changes only in exposure and colour. A screenshot or document changes only in exposure and colour.\n\n';

export const RELIGHT_STRICT =
  '\n\nIMPORTANT: a previous attempt changed the content of the photograph. This time treat the input as fixed and only repaint its light: identical layout, identical subject, identical edges. If in doubt, change less.';

export const RELIGHT_PROMPTS: Record<string, string> = {
  'point-and-shoot':
    'LIGHT CHANGE: the existing daylight stays. A small flash on the camera fires from the lens position as fill. Everything within a few metres of the camera receives flat, even, frontal fill light: its shadows lift, it reads about half a stop brighter than before, and small bright specular highlights appear on skin, eyes, lips, glossy and wet surfaces. Far objects and the sky are unaffected. A faint, thin, hard-edged shadow appears directly behind near objects on any surface immediately behind them. White balance: neutral daylight.',

  'after-dark':
    'LIGHT CHANGE: it is now night and the only light is a small flash on the camera. Ambient daylight is gone: the sky, if visible, is dark; sunlight and its shadows are gone; existing lamps, windows, signs and screens are switched on and glow warm. The flash is at the lens: everything near the camera is bright and evenly lit from the front with small specular highlights on skin, eyes and glossy surfaces. Brightness falls off quickly with distance (two stops darker each time the distance doubles), so the mid-distance is dim and the far background is near black except for its own lights. A hard, thin shadow falls directly behind near objects onto surfaces right behind them. White balance is set for the flash, so flash-lit areas are neutral and tungsten lamps look orange.',

  rouge:
    'LIGHT CHANGE: it is now night and the only light is a flash on the camera covered with a saturated red gel. Everything the flash reaches is lit by vivid red light: skin, hair, clothing, walls and objects near the camera are washed in deep red and crimson with bright red-pink specular hotspots; white surfaces turn red. Areas the flash does not reach fall into deep dark teal-blue shadow, so the background is dark and cool. Brightness falls off quickly with distance. A hard shadow falls directly behind near objects. The sky, if visible, is dark; existing lamps and signs are on.',

  paparazzi:
    'LIGHT CHANGE: it is now night and a powerful press flash fires from the lens position. Everything near the camera is lit hard and frontal and slightly overexposed: skin and light clothing push toward white with strong specular highlights, and detail is frozen crisp. Brightness falls off steeply with distance: the mid-distance is dim and the far background is near black apart from its own lights, which stay small and sharp. A hard black shadow falls directly behind near objects. White balance is cool neutral daylight so any lamps look orange.',

  'golden-hour':
    'LIGHT CHANGE: the sun is now about five degrees above the horizon, warm amber (about 2800 K), coming from the side and slightly behind the scene; choose the side that agrees with any existing shadows. Surfaces facing the sun turn warm and bright; surfaces facing away fall into soft open shadow that is slightly cooler. A thin warm rim light traces edges that face the sun (hair, shoulders, leaves, roof lines). Shadows on the ground become long and soft-edged, stretching away from the sun. The sky, if visible, is warm orange-pink near the horizon fading to pale blue above, with clouds lit warm from below. A faint warm haze lowers contrast toward the sun. Every cloud, building, tree and object stays exactly where it is.',

  'blue-hour':
    'LIGHT CHANGE: it is now twenty minutes after sunset. Overall exposure drops about two stops. All ambient light is cool blue: the sky, if visible, is deep blue to indigo with no sunlit clouds; ground, walls and shadows are blue-grey. Every artificial light already in the photo is switched on and warm: street lamps, windows, shop signs, headlights, screens and candles glow orange-yellow with soft halos. If there is a person or near subject and no lamp is visible, a warm lamp just outside the frame lights their face and one side of the body softly. There are no hard sun shadows anywhere. Warm skin against blue surroundings.',

  'window-light':
    'LIGHT CHANGE: the only light is one large, soft window of daylight to one side of the camera; choose the side that agrees with the existing light. The window side of everything near the camera is bright, clean and softly lit, with a gradual wrap-around falloff into gentle open shadow on the far side. Any eyes get a soft rectangular catchlight. The background becomes a little darker and quieter than the foreground. Neutral, slightly warm daylight, low contrast, no harsh shadows. Direct sun and flash are gone.',

  'y2k-compact':
    'LIGHT CHANGE: a small built-in flash fires straight from the lens, the way a 2003 compact camera does. The existing ambient light, sky and time of day stay exactly as they are. Everything within a few metres of the camera is lit flat and bright from the front with small hotspots on skin, eyes and glossy surfaces, and reads about half a stop brighter than before; the brightest flash-lit areas may clip to white. A hard, thin shadow falls directly behind near objects onto surfaces right behind them. Distant scenery is unchanged. White balance slightly cool.',

  'bedroom-webcam':
    'LIGHT CHANGE: it is now night, indoors. Daylight is gone. The scene is lit by a warm bedside lamp to one side and by the pale glow of a laptop screen from the camera position, which lights whatever is near the camera softly from the front. Warm orange-pink ambient light, dim background, soft blown highlights near the lamp. Existing lamps are on.',
};

/** The booth strip is a format change, not a relight; it keeps its own generative prompt. */
export const BOOTH_STRIP_PROMPT =
  'FORMAT: a vintage analog photobooth strip: four frames stacked vertically on cream photo paper with thin white borders between them. In each frame the same subject from the input photograph (identical face, hair, skin tone and outfit, or the identical object if there is no person) shows a different natural expression and small change of pose, photographed by the booth\'s harsh direct flash against the booth\'s plain curtain backdrop. Render clean: no grain, no scratches, no texture; the print look is applied afterwards. Keep identity exactly; vary only expression and small head and hand movements. Add no people or objects that are not in the input.';

export function strengthHint(strength: number | undefined): string {
  if (strength === undefined || strength >= 0.85) return '';
  if (strength >= 0.55) return '\n\nSTRENGTH: apply the lighting change at about two thirds of full effect.';
  return '\n\nSTRENGTH: apply the lighting change lightly; the new light is clearly present but restrained.';
}

export function buildRelightPrompt(lookId: string, { strength, strict = false }: { strength?: number; strict?: boolean } = {}): string {
  const light = RELIGHT_PROMPTS[lookId];
  if (!light) throw new Error(`no relight prompt for ${lookId}`);
  return `${RELIGHT_RULES}${light}${strengthHint(strength)}${strict ? RELIGHT_STRICT : ''}\n\nOutput one image.`;
}
