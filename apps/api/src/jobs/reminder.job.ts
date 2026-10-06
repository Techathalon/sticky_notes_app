import cron from 'node-cron';
import { prisma } from '../config/database';
import { sendPushNotification, sendAlarmNotification } from '../services/push.service';

/**
 * Runs every minute. Finds todos and events whose reminderAt is within
 * the current minute window and sends push notifications.
 */
export function startReminderJob(): void {
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    const from = new Date(now.getTime() - 30_000); // 30s ago
    const to = new Date(now.getTime() + 30_000);   // 30s ahead

    await checkTodoReminders(from, to);
    await checkEventReminders(from, to);
    await checkTodoAlarms(from, to);
    await checkEventAlarms(from, to);
    await checkTodoStartNotifs(from, to);
    await checkEventStartNotifs(from, to);
    await checkDailyExpenseSummary(now);
  });

  console.info('[reminder-job] Started — checking reminders every minute');
}

async function checkTodoReminders(from: Date, to: Date): Promise<void> {
  try {
    const todos = await prisma.todo.findMany({
      where: {
        reminderAt: { gte: from, lte: to },
        reminderSentAt: null,
        completed: false,
      },
      include: {
        user: {
          include: { deviceTokens: true },
        },
      },
    });

    for (const todo of todos) {
      const tokens = todo.user.deviceTokens.map((d) => d.token);
      if (tokens.length > 0) {
        await sendPushNotification(
          tokens,
          'Task Reminder',
          `${todo.title} is due soon`,
          { type: 'task_reminder', todoId: todo.id },
        );
      }
      await prisma.todo.update({
        where: { id: todo.id },
        data: { reminderSentAt: new Date() },
      });
    }
  } catch (err) {
    console.error('[reminder-job] Todo check failed:', err);
  }
}

async function checkEventReminders(from: Date, to: Date): Promise<void> {
  try {
    const events = await prisma.event.findMany({
      where: {
        reminderAt: { gte: from, lte: to },
        reminderSentAt: null,
      },
      include: {
        user: {
          include: { deviceTokens: true },
        },
      },
    });

    for (const event of events) {
      const tokens = event.user.deviceTokens.map((d) => d.token);
      if (tokens.length > 0) {
        await sendPushNotification(
          tokens,
          'Event Reminder',
          `${event.title} is starting soon`,
          { type: 'event_reminder', eventId: event.id },
        );
      }
      await prisma.event.update({
        where: { id: event.id },
        data: { reminderSentAt: new Date() },
      });
    }
  } catch (err) {
    console.error('[reminder-job] Event check failed:', err);
  }
}

async function checkTodoAlarms(from: Date, to: Date): Promise<void> {
  try {
    const todos = await prisma.todo.findMany({
      where: {
        alarmAt: { gte: from, lte: to },
        alarmSentAt: null,
        completed: false,
      },
      include: { user: { include: { deviceTokens: true } } },
    });

    for (const todo of todos) {
      const tokens = todo.user.deviceTokens.map((d) => d.token);
      if (tokens.length > 0) {
        console.log("alarm sent to:", tokens);
        await sendAlarmNotification(tokens, todo.id, todo.title, 'task', todo.alarmAt!.toISOString());
      }
      await prisma.todo.update({
        where: { id: todo.id },
        data: { alarmSentAt: new Date() },
      });
    }
  } catch (err) {
    console.error('[reminder-job] Todo alarm check failed:', err);
  }
}

async function checkEventAlarms(from: Date, to: Date): Promise<void> {
  try {
    const events = await prisma.event.findMany({
      where: {
        alarmAt: { gte: from, lte: to },
        alarmSentAt: null,
      },
      include: { user: { include: { deviceTokens: true } } },
    });

    for (const event of events) {
      const tokens = event.user.deviceTokens.map((d) => d.token);
      if (tokens.length > 0) {
        await sendAlarmNotification(tokens, event.id, event.title, 'event', event.alarmAt!.toISOString());
      }
      await prisma.event.update({
        where: { id: event.id },
        data: { alarmSentAt: new Date() },
      });
    }
  } catch (err) {
    console.error('[reminder-job] Event alarm check failed:', err);
  }
}

async function checkTodoStartNotifs(from: Date, to: Date): Promise<void> {
  try {
    const todos = await prisma.todo.findMany({
      where: {
        startAt: { gte: from, lte: to },
        startNotifSentAt: null,
        completed: false,
      },
      include: { user: { include: { deviceTokens: true } } },
    });

    for (const todo of todos) {
      const tokens = todo.user.deviceTokens.map((d) => d.token);
      if (tokens.length > 0) {
        await sendPushNotification(
          tokens,
          '⏰ Task Started',
          `${todo.title} is starting now`,
          { type: 'task_start', todoId: todo.id },
        );
      }
      await prisma.todo.update({
        where: { id: todo.id },
        data: { startNotifSentAt: new Date() },
      });
    }
  } catch (err) {
    console.error('[reminder-job] Todo start notif check failed:', err);
  }
}

async function checkEventStartNotifs(from: Date, to: Date): Promise<void> {
  try {
    const events = await prisma.event.findMany({
      where: {
        startDate: { gte: from, lte: to },
        startNotifSentAt: null,
      },
      include: { user: { include: { deviceTokens: true } } },
    });

    for (const event of events) {
      const tokens = event.user.deviceTokens.map((d) => d.token);
      if (tokens.length > 0) {
        await sendPushNotification(
          tokens,
          '📅 Event Started',
          `${event.title} is starting now`,
          { type: 'event_start', eventId: event.id },
        );
      }
      await prisma.event.update({
        where: { id: event.id },
        data: { startNotifSentAt: new Date() },
      });
    }
  } catch (err) {
    console.error('[reminder-job] Event start notif check failed:', err);
  }
}

async function checkDailyExpenseSummary(now: Date): Promise<void> {
  try {
    // Current UTC HH:MM
    const utcHH = String(now.getUTCHours()).padStart(2, '0');
    const utcMM = String(now.getUTCMinutes()).padStart(2, '0');
    const currentTime = `${utcHH}:${utcMM}`;

    // Find all users whose summary is enabled and time matches current UTC minute
    const settingsList = await prisma.userAppSettings.findMany({
      where: { expenseSummaryEnabled: true, expenseSummaryTime: currentTime },
      include: { user: { include: { deviceTokens: true } } },
    });

    for (const settings of settingsList) {
      const tokens = settings.user.deviceTokens.map((d: { token: string }) => d.token);
      if (tokens.length === 0) continue;

      // Today's date in YYYY-MM-DD (UTC)
      const today = now.toISOString().slice(0, 10);

      const expenses = await prisma.expense.findMany({
        where: { userId: settings.userId, date: today },
      });

      const total = expenses.reduce((s, e) => s + e.amount, 0);
      const count = expenses.length;

      const body = count === 0
        ? 'No expenses recorded today'
        : `${count} expense${count > 1 ? 's' : ''} · Total ₹${total.toFixed(2)}`;

      await sendPushNotification(
        tokens,
        '📊 Daily Expense Summary',
        body,
        { type: 'expense_summary', date: today },
      );
    }
  } catch (err) {
    console.error('[reminder-job] Daily expense summary failed:', err);
  }
}
