import { Router } from 'express';
import { authRouter } from './auth.routes';
import { notesRouter } from './notes.routes';
import { todosRouter } from './todos.routes';
import { eventsRouter } from './events.routes';
import { expensesRouter } from './expenses.routes';
import { pushRouter } from './push.routes';
import { appSettingsRouter } from './app-settings.routes';

export const router: Router = Router();

router.use('/auth', authRouter);
router.use('/notes', notesRouter);
router.use('/todos', todosRouter);
router.use('/events', eventsRouter);
router.use('/expenses', expensesRouter);
router.use('/push', pushRouter);
router.use('/app-settings', appSettingsRouter);
