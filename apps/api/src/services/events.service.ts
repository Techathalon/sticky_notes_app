import { Event } from '@repo/types';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { CreateEventInput, UpdateEventInput } from '../validation/event.schema';
import { sendScheduleAlarmToDevices, sendCancelAlarmToDevices } from './push.service';

async function getTokensForUser(userId: string): Promise<string[]> {
  const records = await prisma.deviceToken.findMany({ where: { userId } });
  return records.map((r) => r.token);
}

export class EventsService {
  async getEvents(userId: string): Promise<Event[]> {
    const events = await prisma.event.findMany({
      where: { userId },
      orderBy: { startDate: 'asc' },
    });
    return events.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      startDate: e.startDate.toISOString(),
      endDate: e.endDate.toISOString(),
      color: e.color,
      category: e.category ?? null,
      location: e.location ?? null,
      reminderAt: e.reminderAt ? e.reminderAt.toISOString() : null,
      alarmAt: e.alarmAt ? e.alarmAt.toISOString() : null,
      userId: e.userId,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    }));
  }

  async createEvent(userId: string, input: CreateEventInput): Promise<Event> {
    const event = await prisma.event.create({
      data: {
        title: input.title,
        description: input.description,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        color: input.color ?? '#99CCFF',
        category: input.category ?? 'General',
        location: input.location ?? null,
        reminderAt: input.reminderAt ? new Date(input.reminderAt) : null,
        alarmAt: input.alarmAt ? new Date(input.alarmAt) : null,
        userId,
      },
    });
    // Immediately notify all logged-in devices to schedule local alarm
    if (event.alarmAt) {
      const tokens = await getTokensForUser(userId);
      if (tokens.length > 0) {
        sendScheduleAlarmToDevices(tokens, event.id, event.title, event.alarmAt.toISOString(), 'event').catch(() => {});
      }
    }
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      startDate: event.startDate.toISOString(),
      endDate: event.endDate.toISOString(),
      color: event.color,
      category: event.category ?? null,
      location: event.location ?? null,
      reminderAt: event.reminderAt ? event.reminderAt.toISOString() : null,
      alarmAt: event.alarmAt ? event.alarmAt.toISOString() : null,
      userId: event.userId,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    };
  }

  async updateEvent(userId: string, eventId: string, input: UpdateEventInput): Promise<Event> {
    const existing = await prisma.event.findFirst({ where: { id: eventId, userId } });
    if (!existing) throw new AppError(404, 'Event not found');

    const data: Record<string, unknown> = {
      ...input,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
    };
    if (input.startDate !== undefined) {
      data.startNotifSentAt = null;
    }
    if (input.reminderAt !== undefined) {
      data.reminderAt = input.reminderAt ? new Date(input.reminderAt) : null;
      data.reminderSentAt = null;
    }
    if (input.alarmAt !== undefined) {
      data.alarmAt = input.alarmAt ? new Date(input.alarmAt) : null;
      data.alarmSentAt = null;
    }

    const event = await prisma.event.update({ where: { id: eventId, userId }, data });

    // Notify all logged-in devices to reschedule or cancel local alarm
    if (input.alarmAt !== undefined) {
      const tokens = await getTokensForUser(userId);
      if (tokens.length > 0) {
        if (input.alarmAt) {
          sendScheduleAlarmToDevices(tokens, event.id, event.title, new Date(input.alarmAt).toISOString(), 'event').catch(() => {});
        } else {
          sendCancelAlarmToDevices(tokens, event.id).catch(() => {});
        }
      }
    }

    return {
      id: event.id,
      title: event.title,
      description: event.description,
      startDate: event.startDate.toISOString(),
      endDate: event.endDate.toISOString(),
      color: event.color,
      category: event.category ?? null,
      location: event.location ?? null,
      reminderAt: event.reminderAt ? event.reminderAt.toISOString() : null,
      alarmAt: event.alarmAt ? event.alarmAt.toISOString() : null,
      userId: event.userId,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    };
  }

  async deleteEvent(userId: string, eventId: string): Promise<void> {
    const existing = await prisma.event.findFirst({ where: { id: eventId, userId } });
    if (!existing) throw new AppError(404, 'Event not found');
    await prisma.event.delete({ where: { id: eventId, userId } });
  }
}
