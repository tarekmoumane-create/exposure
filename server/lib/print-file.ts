import sharp from 'sharp';

import { PRINT_HEIGHT, PRINT_WIDTH } from './prints.js';

/**
 * Builds the exact file the lab prints: the whole photo, turned upright for the paper and centred
 * on white. A phone photo is rarely the 2:3 shape of a 4x6, and letting the lab fill the paper would
 * crop it, so any difference becomes a thin white edge instead.
 */
export async function composePrint(photo: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(photo).rotate().toBuffer({ resolveWithObject: true });
  const turned = info.width > info.height ? sharp(data).rotate(90) : sharp(data);
  return turned
    .resize(PRINT_WIDTH, PRINT_HEIGHT, { fit: 'contain', background: '#FFFFFF', kernel: 'lanczos3' })
    .flatten({ background: '#FFFFFF' })
    .jpeg({ quality: 93, chromaSubsampling: '4:4:4' })
    .toBuffer();
}
