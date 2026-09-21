// shared/src/schemas/reports.ts

import { z } from 'zod';
import { isoDate } from '../primitives';

// both optional, the service defaults to the last 180 days in the org's timezone
export const reportRangeQuery = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
});