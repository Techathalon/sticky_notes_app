import { z } from 'zod';

const todoStatusSchema   = z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED']);
const todoPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);

export const createTodoSchema = z.object({
  title:       z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional(),
  status:      todoStatusSchema.optional(),
  priority:    todoPrioritySchema.optional(),
  dueDate:     z.string().datetime({ offset: true }).optional(),
  dueTime:     z.string().regex(/^\d{2}:\d{2}$/).optional(),
  startAt:     z.string().datetime({ offset: true }).nullable().optional(),
  reminderAt:  z.string().datetime({ offset: true }).nullable().optional(),
  alarmAt:     z.string().datetime({ offset: true }).nullable().optional(),
});

export const updateTodoSchema = z.object({
  title:       z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  completed:   z.boolean().optional(),
  status:      todoStatusSchema.optional(),
  priority:    todoPrioritySchema.optional(),
  dueDate:     z.string().datetime({ offset: true }).nullable().optional(),
  dueTime:     z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  startAt:     z.string().datetime({ offset: true }).nullable().optional(),
  reminderAt:  z.string().datetime({ offset: true }).nullable().optional(),
  alarmAt:     z.string().datetime({ offset: true }).nullable().optional(),
});

export const todoIdSchema = z.object({
  id: z.string().cuid('Invalid todo ID'),
});

export type CreateTodoInput = z.infer<typeof createTodoSchema>;
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;
