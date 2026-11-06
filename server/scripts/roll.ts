/**
 * Develops a folder of photos as one roll, the way the app does: the first frame on its own, the
 * rest in parallel with the first as the match frame.
 *
 *   npx tsx scripts/roll.ts --dir <photos> --out <dir> --look gold-200 [--no-match] [--upscale 1280]
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

import { runLook } from '../lib/pipeline.js';

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const useMatch = !process.argv.includes('--no-match');

async function main() {
  const dir = arg('dir')!;
  const out = arg('out')!;
  const look = arg('look') ?? 'gold-200';
  const upscale = arg('upscale') ? Number(arg('upscale')) : undefined;
  fs.mkdirSync(out, { recursive: true });
  const files = fs.readdirSync(dir).filter((f) => /\.jpe?g$/i.test(f)).sort();
  const develop = async (file: string, match?: Buffer) => {
    let data: Buffer = fs.readFileSync(path.join(dir, file));
    if (upscale) data = await sharp(data).resize({ width: upscale, kernel: 'lanczos3' }).jpeg({ quality: 94 }).toBuffer();
    const r = await runLook(look, { mimeType: 'image/jpeg', data }, {
      apiKey: process.env.GEMINI_API_KEY, model: 'gemini-nano-banana-2.1', fallbackModels: ['gemini-3.1-flash-image'],
      imageSize: '2K', thinkingLevel: 'medium', deadline: Date.now() + 110_000,
      match: match ? { mimeType: 'image/jpeg', data: match } : undefined,
    });
    fs.writeFileSync(path.join(out, file), r.jpeg);
    console.log(file, `${r.ms}ms`, r.relit ? 'relit' : 'FALLBACK', r.verification ? `aligned=${r.verification.aligned.toFixed(2)} added=${r.verification.added.toFixed(2)}` : '', r.attempts);
    return r.jpeg;
  };
  const first = await develop(files[0]);
  const matchFrame = useMatch ? await sharp(first).resize({ width: 640 }).jpeg({ quality: 85 }).toBuffer() : undefined;
  const rest = files.slice(1);
  for (let i = 0; i < rest.length; i += 4) {
    await Promise.all(rest.slice(i, i + 4).map((f) => develop(f, matchFrame).catch((e) => console.log(f, 'ERROR', (e as Error).message.slice(0, 120)))));
  }
}
main();
