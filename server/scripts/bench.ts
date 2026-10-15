/**
 * Runs looks over a folder of test photos and writes results plus a contact sheet per look.
 *
 *   npx tsx scripts/bench.ts --dir <photos> --out <dir> [--looks a,b] [--images name,name] [--ai]
 *
 * Without --ai the model is skipped and relight looks use their deterministic fallback, which is
 * enough to tune the rendering. With --ai the key from .env.local is used and each relight look
 * costs one model call per photo.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

import { LOOKS } from '../lib/looks.js';
import { runLook } from '../lib/pipeline.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

function loadEnv(file: string): Record<string, string> {
  if (!fs.existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

async function contactSheet(pairs: { before: string; after: string; label: string }[], out: string) {
  const H = 420;
  const tiles: { input: Buffer; left: number; top: number }[] = [];
  const perRow = 2;
  let row = 0, col = 0, maxW = 0;
  const rows: number[] = [];
  const rendered: { buf: Buffer; w: number }[] = [];
  for (const p of pairs) {
    const b = await sharp(p.before).resize({ height: H }).toBuffer();
    const a = await sharp(p.after).resize({ height: H }).toBuffer();
    const bw = (await sharp(b).metadata()).width!;
    const aw = (await sharp(a).metadata()).width!;
    const label = Buffer.from(`<svg width="${bw + aw + 8}" height="28"><rect width="100%" height="100%" fill="#111"/><text x="8" y="20" font-size="16" font-family="Helvetica" fill="#eee">${p.label}</text></svg>`);
    const pair = await sharp({ create: { width: bw + aw + 8, height: H + 28, channels: 3, background: '#111' } })
      .composite([{ input: label, left: 0, top: 0 }, { input: b, left: 0, top: 28 }, { input: a, left: bw + 8, top: 28 }])
      .jpeg({ quality: 88 }).toBuffer();
    rendered.push({ buf: pair, w: bw + aw + 8 });
  }
  const rowW: number[] = [];
  rendered.forEach((r, i) => { const ri = Math.floor(i / perRow); rowW[ri] = (rowW[ri] ?? 0) + r.w + 12; });
  const sheetW = Math.max(...rowW);
  const sheetH = Math.ceil(rendered.length / perRow) * (H + 28 + 12);
  let x = 0, y = 0;
  rendered.forEach((r, i) => {
    if (i % perRow === 0 && i > 0) { x = 0; y += H + 28 + 12; }
    tiles.push({ input: r.buf, left: x, top: y });
    x += r.w + 12;
  });
  await sharp({ create: { width: sheetW, height: sheetH, channels: 3, background: '#222' } }).composite(tiles).jpeg({ quality: 86 }).toFile(out);
}

async function main() {
  const dir = arg('dir');
  const outDir = arg('out');
  if (!dir || !outDir) throw new Error('--dir and --out are required');
  const env = loadEnv(path.join(process.cwd(), '.env.local'));
  const ai = flag('ai');
  const apiKey = ai ? (process.env.GEMINI_API_KEY ?? env.GEMINI_API_KEY) : undefined;
  if (ai && !apiKey) throw new Error('--ai needs GEMINI_API_KEY');
  const looks = (arg('looks')?.split(',') ?? Object.keys(LOOKS)).filter((l) => LOOKS[l]);
  const onlyImages = arg('images')?.split(',');
  const images = fs.readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).filter((f) => !onlyImages || onlyImages.some((n) => f.includes(n))).sort();
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`${images.length} images × ${looks.length} looks, model ${ai ? 'on' : 'off'}`);
  for (const look of looks) {
    const lookDir = path.join(outDir, look);
    fs.mkdirSync(lookDir, { recursive: true });
    const pairs: { before: string; after: string; label: string }[] = [];
    for (const file of images) {
      const data = fs.readFileSync(path.join(dir, file));
      const mimeType = file.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      try {
        const r = await runLook(look, { mimeType, data }, {
          apiKey,
          model: process.env.GEMINI_IMAGE_MODEL ?? env.GEMINI_IMAGE_MODEL ?? 'gemini-nano-banana-2.1',
          fallbackModels: ['gemini-3.1-flash-image'],
          imageSize: '2K',
          thinkingLevel: 'medium',
          deadline: Date.now() + 110_000,
          allowRelight: ai,
          onCandidate: flag('debug') ? async ({ attempt, jpeg, verification, accepted }) => {
            fs.writeFileSync(path.join(lookDir, file.replace(/\.\w+$/, `.candidate${attempt + 1}${accepted ? '' : '.rejected'}.jpg`)), jpeg);
            console.log(`  candidate ${attempt + 1}: aligned=${verification.aligned.toFixed(2)} added=${verification.added.toFixed(2)} edges=${verification.edges.toFixed(2)} ${accepted ? 'accepted' : 'rejected'}`);
          } : undefined,
        });
        const outFile = path.join(lookDir, file.replace(/\.\w+$/, '.jpg'));
        fs.writeFileSync(outFile, r.jpeg);
        const v = r.verification ? ` aligned=${r.verification.aligned.toFixed(2)} added=${r.verification.added.toFixed(2)}` : '';
        console.log(`${look.padEnd(16)} ${file.padEnd(18)} ${String(r.ms).padStart(6)}ms ${r.relit ? 'relit' : r.fallback ? 'fallback' : 'render'}${v}${r.attempts > 1 ? ` attempts=${r.attempts}` : ''}`);
        pairs.push({ before: path.join(dir, file), after: outFile, label: `${look} · ${file}${v}${r.fallback ? ' · FALLBACK' : ''}` });
      } catch (error) {
        console.log(`${look.padEnd(16)} ${file.padEnd(18)} ERROR ${(error as Error).message.slice(0, 160)}`);
      }
    }
    if (pairs.length) await contactSheet(pairs, path.join(outDir, `${look}.sheet.jpg`));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
