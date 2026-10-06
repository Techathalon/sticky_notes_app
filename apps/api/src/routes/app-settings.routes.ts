import { Router } from 'express';
import { AppSettingsController } from '../controllers/app-settings.controller';
import { authenticate } from '../middleware/auth';

export const appSettingsRouter: Router = Router();
const ctrl = new AppSettingsController();

appSettingsRouter.use(authenticate);

// GET  /api/app-settings
appSettingsRouter.get('/', ctrl.getSettings);

// PUT  /api/app-settings
appSettingsRouter.put('/', ctrl.saveSettings);
