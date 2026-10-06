import { z } from 'zod';

const NOTE_COLORS = ['#FFFF88', '#FF9999', '#99FF99', '#99CCFF', '#FFB347', '#DDA0DD'] as const;

export const createNoteSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string().max(50000).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional(),
  category: z.string().max(50).optional(),
  isLocked: z.boolean().optional(),
});

export const updateNoteSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().max(50000).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional(),
  category: z.string().max(50).optional(),
  isLocked: z.boolean().optional(),
});

export const noteIdSchema = z.object({
  id: z.string().cuid('Invalid note ID'),
});

export { NOTE_COLORS };

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
