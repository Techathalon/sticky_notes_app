import { Note } from '@repo/types';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { CreateNoteInput, UpdateNoteInput } from '../validation/note.schema';

export class NotesService {
  async getNotes(userId: string): Promise<Note[]> {
    const notes = await prisma.note.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return notes.map((n) => ({
      id: n.id,
      title: n.title,
      content: n.content,
      color: n.color,
      category: n.category,
      isLocked: n.isLocked,
      userId: n.userId,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    }));
  }

  async createNote(userId: string, input: CreateNoteInput): Promise<Note> {
    const note = await prisma.note.create({
      data: { ...input, userId },
    });
    return {
      id: note.id,
      title: note.title,
      content: note.content,
      color: note.color,
      category: note.category,
      isLocked: note.isLocked,
      userId: note.userId,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    };
  }

  async updateNote(userId: string, noteId: string, input: UpdateNoteInput): Promise<Note> {
    const existing = await prisma.note.findFirst({ where: { id: noteId, userId } });
    if (!existing) throw new AppError(404, 'Note not found');
    const note = await prisma.note.update({ where: { id: noteId, userId }, data: input });
    return {
      id: note.id,
      title: note.title,
      content: note.content,
      color: note.color,
      category: note.category,
      isLocked: note.isLocked,
      userId: note.userId,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    };
  }

  async deleteNote(userId: string, noteId: string): Promise<void> {
    const existing = await prisma.note.findFirst({ where: { id: noteId, userId } });
    if (!existing) throw new AppError(404, 'Note not found');
    await prisma.note.delete({ where: { id: noteId, userId } });
  }
}
