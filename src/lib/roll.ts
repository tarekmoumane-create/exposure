import { type Frame, type Roll } from '@/store/app-store';

export function countFrames(roll: Roll) {
  const count = (status: Frame['status']) => roll.frames.filter((frame) => frame.status === status).length;
  return { total: roll.frames.length, done: count('done'), developing: count('developing'), waiting: count('waiting'), failed: count('failed') };
}

/** The roll's state in a few words, for envelopes and headers. */
export function rollSummary(roll: Roll): string {
  const { total, done, developing, waiting, failed } = countFrames(roll);
  if (done === total) return total === 1 ? '1 frame' : `${total} frames`;
  if (developing > 0) return `Developing ${done} of ${total}`;
  if (waiting > 0) return `${waiting} waiting`;
  return `${failed} to retry`;
}

/** Today as a roll name, like "Saturday, Nov 7". */
export function defaultRollName(date = new Date()): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}
