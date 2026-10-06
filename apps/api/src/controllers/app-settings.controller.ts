import { Response, NextFunction } from 'express';
import { AppSettingsService } from '../services/app-settings.service';
import { AuthenticatedRequest } from '../middleware/auth';
import { sendSyncSettings } from '../services/push.service';
import { prisma } from '../config/database';
import { AppSettings } from '@repo/types';

export class AppSettingsController {
  private readonly service = new AppSettingsService();

  getSettings = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const settings = await this.service.getSettings(req.user!.id);
      res.json({ data: settings });
    } catch (err) {
      next(err);
    }
  };

  saveSettings = async (
    req: AuthenticatedRequest & { body: AppSettings },
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const settings = await this.service.saveSettings(req.user!.id, req.body);
      // Notify all OTHER devices of this user to reload their settings silently.
      const tokens = await prisma.deviceToken.findMany({ where: { userId: req.user!.id } });
      if (tokens.length > 0) {
        sendSyncSettings(tokens.map((t) => t.token)).catch(() => {});
      }
      res.json({ data: settings });
    } catch (err) {
      next(err);
    }
  };
}
