import type { VercelRequest, VercelResponse } from '@vercel/node';

import { COUNTRY, MAX_PRINTS, MIN_PRINTS, PRICE_PER_PRINT_CENTS, printsEnabled, SHIPPING_CENTS } from '../../lib/prints.js';

/** GET /api/prints/config: tells the app whether prints are on and what they cost. */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({ enabled: printsEnabled(), pricePerPrintCents: PRICE_PER_PRINT_CENTS, shippingCents: SHIPPING_CENTS, country: COUNTRY, minPrints: MIN_PRINTS, maxPrints: MAX_PRINTS });
}
