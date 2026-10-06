import { Response, NextFunction, Request } from 'express';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { NotesService } from '../services/notes.service';
import { AuthenticatedRequest } from '../middleware/auth';
import { CreateNoteInput, UpdateNoteInput } from '../validation/note.schema';
import { uploadImage, deleteImage } from '../services/storage.service';
import { AppError } from '../middleware/errorHandler';
import { env } from '../config';
//import { string } from 'zod';

const VALID_CATEGORIES = ['Food', 'Transport', 'Shopping', 'Health', 'Bills', 'Other'] as const;
type ExpenseCategory = typeof VALID_CATEGORIES[number];

export class NotesController {
  private readonly service = new NotesService();

  getNotes = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // TODO: implement in NotesService
      const notes = await this.service.getNotes(req.user!.id);
      res.json({ data: notes });
    } catch (err) {
      next(err);
    }
  };

  createNote = async (
    req: AuthenticatedRequest & { body: CreateNoteInput },
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      // TODO: implement in NotesService
      const note = await this.service.createNote(req.user!.id, req.body);
      res.status(201).json({ data: note });
    } catch (err) {
      next(err);
    }
  };

  updateNote = async (
    req: AuthenticatedRequest & { body: UpdateNoteInput; params: { id: string } },
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      // TODO: implement in NotesService
      const note = await this.service.updateNote(req.user!.id, req.params.id, req.body);
      res.json({ data: note });
    } catch (err) {
      next(err);
    }
  };

  deleteNote = async (
    req: AuthenticatedRequest & { params: { id: string } },
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await this.service.deleteNote(req.user!.id, req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  uploadImage = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.file) throw new AppError(400, 'No file uploaded');

      // Android sends application/octet-stream for all parts regardless of FormData type field
      let mimeType = req.file.mimetype;
      if (mimeType === 'application/octet-stream') {
        const ext = path.extname(req.file.originalname).toLowerCase().slice(1);
        const MIME_MAP: Record<string, string> = {
          jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
          gif: 'image/gif',  webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
        };
        mimeType = MIME_MAP[ext] ?? 'image/jpeg';
      }

      const url = await uploadImage(req.file.buffer, mimeType);
      res.json({ data: { url } });
    } catch (err) {
      next(err);
    }
  };

  deleteImage = async (
    req: Request & { body: { url: string } },
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { url } = req.body;
      if (!url) throw new AppError(400, 'Image URL is required');
      await deleteImage(url);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  detectExpenses = async (
    req: Request & { body: { text: string } },
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { text } = req.body;
      if (!text?.trim()) { res.json({ data: [] }); return; }

      const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
      const prompt = `Analyze this note and extract any expenses the user has mentioned spending money on.

For each expense found, return:
- amount: numeric value (number, e.g. 250)
- title: short description of what was spent on (string, max 50 chars)
- category: exactly one of: Food, Transport, Shopping, Health, Bills, Other
- snippet: the exact sentence or phrase from the note that mentions this expense (max 80 chars)
- date: date of the expense in YYYY-MM-DD format IF mentioned, otherwise null

Rules:
- Only include real spending/payment mentions with a numeric amount
- Do not include hypothetical, future, or estimated amounts
- Extract date only if clearly mentioned (e.g. "yesterday", "on 5 Jan", "12/03/2026")
- Convert relative dates like "yesterday", "today" into actual YYYY-MM-DD
- If no date is mentioned → return null
- If the same expense appears multiple times, include it only once

Return ONLY a valid JSON array, nothing else. Example:
[
  {
    "amount": 250,
    "title": "Lunch at café",
    "category": "Food",
    "snippet": "spent 250 on lunch at café",
    "date": "2026-04-10"
  }
]

If no expenses found, return: []

Note text:
${text}`;

      const response = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const textBlock = response.content.find((b) => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') { res.json({ data: [] }); return; }

      const jsonMatch = textBlock.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) { res.json({ data: [] }); return; }

      const parsed: unknown = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) { res.json({ data: [] }); return; }

      type RawExpense = { amount: unknown; title: unknown; category: unknown; snippet: unknown ;date?: unknown};
      const results = (parsed as RawExpense[])
        .filter((item) =>
          typeof item.amount === 'number' &&
          item.amount > 0 &&
          typeof item.title === 'string' &&
          VALID_CATEGORIES.includes(item.category as ExpenseCategory),
        )
        .map((item) => {
    let formattedDate: string;
    const parsedDate = new Date(item.date as string);
    if (item.date && !isNaN(parsedDate.getTime())) {
      formattedDate = parsedDate.toISOString().split('T')[0];
    } else {
      formattedDate = new Date().toISOString().split('T')[0];
    }
    console.log("Expense:", item.title, 'from the backend:  Parsed date:', item.date, 'Formatted date:', formattedDate);
    return {
      amount: item.amount as number,
      title: String(item.title).slice(0, 50).trim(),
      category: item.category as ExpenseCategory,
      snippet: String(item.snippet ?? '').slice(0, 80).trim(),
      date: formattedDate, 
    };
  });

      res.json({ data: results });
    } catch (err) {
      next(err);
    }
  };
}
