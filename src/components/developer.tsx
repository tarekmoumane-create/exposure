import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { GenerateError, generateLook } from '@/lib/generate';
import { type Frame, localDay, type Roll, useAppStore } from '@/store/app-store';

/** Frames developing at once across the app; the server allows a little more than this. */
const MAX_AT_ONCE = 3;
const INFLIGHT_RETRY_MS = 2_500;

/**
 * Works through every waiting frame while the app is open. A roll's first frame runs alone; the
 * rest then run together with it as their match frame, so the set is rendered against one reference.
 * A frame is only started when a photo is available to pay for it, and costs nothing if it fails.
 * Renders nothing.
 */
export function Developer() {
  const { hydrated, aiConsent, rolls, credits, updateFrame, syncCredits, spendCredit } = useAppStore();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const flights = useRef(new Map<string, AbortController>());

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => setActive(status === 'active'));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!hydrated || !aiConsent || !active) return;

    const start = (roll: Roll, frame: Frame, match: Frame | undefined) => {
      if (typeof frame.sourceUri !== 'string') return;
      const controller = new AbortController();
      flights.current.set(frame.id, controller);
      updateFrame(roll.id, frame.id, { status: 'developing', error: undefined });
      const matchSource = match?.thumbUri ?? match?.resultUri;
      generateLook({
        uri: frame.sourceUri,
        lookId: roll.lookId,
        frameId: frame.id,
        matchUri: typeof matchSource === 'string' ? matchSource : undefined,
        day: localDay(),
        signal: controller.signal,
      })
        .then((result) => {
          flights.current.delete(frame.id);
          updateFrame(roll.id, frame.id, { status: 'done', resultUri: result.resultUri, thumbUri: result.thumbUri });
          if (result.credits) syncCredits(result.credits);
          else spendCredit();
        })
        .catch((caught: unknown) => {
          flights.current.delete(frame.id);
          const code = caught instanceof GenerateError ? caught.code : 'unknown';
          if (code === 'credits') {
            syncCredits((caught as GenerateError).credits ?? { daily: 0, pack: 0 });
            updateFrame(roll.id, frame.id, { status: 'waiting' });
          } else if (code === 'inflight') {
            setTimeout(() => updateFrame(roll.id, frame.id, { status: 'waiting' }), INFLIGHT_RETRY_MS);
          } else if ((caught as Error).name === 'AbortError' || AppState.currentState !== 'active') {
            // iOS suspends the request in the background; pick it up again on return.
            updateFrame(roll.id, frame.id, { status: 'waiting' });
          } else {
            updateFrame(roll.id, frame.id, { status: 'failed', error: caught instanceof GenerateError ? caught.message : 'This frame did not develop.' });
          }
        });
    };

    for (const roll of [...rolls].sort((a, b) => a.createdAt - b.createdAt)) {
      const match = roll.frames.find((frame) => frame.status === 'done');
      if (!match && roll.frames.some((frame) => frame.status === 'developing')) continue;
      for (const frame of roll.frames) {
        if (frame.status !== 'waiting') continue;
        if (flights.current.size >= Math.min(MAX_AT_ONCE, credits)) return;
        start(roll, frame, match);
        if (!match) break;
      }
    }
  }, [hydrated, aiConsent, active, rolls, credits, updateFrame, syncCredits, spendCredit]);

  // A deleted roll stops costing photos straight away.
  useEffect(() => {
    const live = new Set(rolls.flatMap((roll) => roll.frames.map((frame) => frame.id)));
    flights.current.forEach((controller, id) => {
      if (!live.has(id)) controller.abort();
    });
  }, [rolls]);

  return null;
}
