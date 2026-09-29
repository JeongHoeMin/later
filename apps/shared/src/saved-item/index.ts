import { z } from 'zod';

export const savedItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  tags: z.array(z.string()),
});

export type SavedItem = z.infer<typeof savedItemSchema>;
