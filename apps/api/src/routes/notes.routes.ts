import { Router } from 'express';
import multer from 'multer';
import { NotesController } from '../controllers/notes.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createNoteSchema, noteIdSchema, updateNoteSchema } from '../validation/note.schema';

export const notesRouter: Router = Router();
const ctrl = new NotesController();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB safety limit
}); // no fileFilter — Android MIME fix is in controller

// All note routes require authentication
notesRouter.use(authenticate);

// GET    /api/notes
notesRouter.get('/', ctrl.getNotes);

// POST   /api/notes
notesRouter.post('/', validate(createNoteSchema), ctrl.createNote);

// POST   /api/notes/upload-image  — before /:id so "upload-image" is not treated as an id
notesRouter.post('/upload-image', upload.single('file'), ctrl.uploadImage);

// POST   /api/notes/detect-expenses
notesRouter.post('/detect-expenses', ctrl.detectExpenses);

// DELETE /api/notes/image  — delete an image from MinIO by URL
notesRouter.delete('/image', ctrl.deleteImage);

// PUT    /api/notes/:id
notesRouter.put(
  '/:id',
  validate(noteIdSchema, 'params'),
  validate(updateNoteSchema),
  ctrl.updateNote,
);

// DELETE /api/notes/:id
notesRouter.delete('/:id', validate(noteIdSchema, 'params'), ctrl.deleteNote);
