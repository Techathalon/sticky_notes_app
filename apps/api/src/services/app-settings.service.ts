import { AppSettings } from '@repo/types';
import { prisma } from '../config/database';

export class AppSettingsService {
  async getSettings(userId: string): Promise<AppSettings> {
    const s = await prisma.userAppSettings.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    return {
      alarmsEnabled:         s.alarmsEnabled,
      taskReminderEnabled:   s.taskReminderEnabled,
      taskReminderTime:      s.taskReminderTime,
      eventReminderEnabled:  s.eventReminderEnabled,
      eventReminderTime:     s.eventReminderTime,
      expenseSummaryEnabled: s.expenseSummaryEnabled,
      expenseSummaryTime:    s.expenseSummaryTime,
      budget80AlertEnabled:  s.budget80AlertEnabled,
      budget100AlertEnabled: s.budget100AlertEnabled,
    };
  }

  async saveSettings(userId: string, input: AppSettings): Promise<AppSettings> {
    await prisma.userAppSettings.upsert({
      where: { userId },
      update: { ...input },
      create: { userId, ...input },
    });
    return input;
  }
}
