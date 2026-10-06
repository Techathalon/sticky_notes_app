import { Todo } from '@repo/types';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { CreateTodoInput, UpdateTodoInput } from '../validation/todo.schema';
import { sendScheduleAlarmToDevices, sendCancelAlarmToDevices } from './push.service';

async function getTokensForUser(userId: string): Promise<string[]> {
  const records = await prisma.deviceToken.findMany({ where: { userId } });
  return records.map((r) => r.token);
}


function mapTodo(t: {
  id: string; title: string; description: string | null;
  completed: boolean; status: string; priority: string;
  dueDate: Date | null; dueTime: string | null;
  startAt: Date | null;
  reminderAt: Date | null; alarmAt: Date | null;
  userId: string; createdAt: Date; updatedAt: Date;
}): Todo {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    completed: t.completed,
    status: t.status as Todo['status'],
    priority: t.priority as Todo['priority'],
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    dueTime: t.dueTime ?? null,
    startAt: t.startAt ? t.startAt.toISOString() : null,
    reminderAt: t.reminderAt ? t.reminderAt.toISOString() : null,
    alarmAt: t.alarmAt ? t.alarmAt.toISOString() : null,
    userId: t.userId,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export class TodosService {
  async getTodos(userId: string): Promise<Todo[]> {
    const todos = await prisma.todo.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return todos.map(mapTodo);
  }

  async createTodo(userId: string, input: CreateTodoInput): Promise<Todo> {
    const completed = input.status === 'COMPLETED';
    const todo = await prisma.todo.create({
      data: {
        title: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        dueTime: input.dueTime,
        startAt: input.startAt ? new Date(input.startAt) : null,
        reminderAt: input.reminderAt ? new Date(input.reminderAt) : null,
        alarmAt: input.alarmAt ? new Date(input.alarmAt) : null,
        userId,
        completed,
      },
    });
    // Immediately notify all logged-in devices to schedule local alarm
    if (todo.alarmAt) {
      const tokens = await getTokensForUser(userId);
      if (tokens.length > 0) {
        sendScheduleAlarmToDevices(tokens, todo.id, todo.title, todo.alarmAt.toISOString(), 'task').catch(() => {});
      }
    }
    return mapTodo(todo);
  }

  async updateTodo(userId: string, todoId: string, input: UpdateTodoInput): Promise<Todo> {
    const existing = await prisma.todo.findFirst({ where: { id: todoId, userId } });
    if (!existing) throw new AppError(404, 'Task not found');

    const data: Record<string, unknown> = { ...input };
    if (input.status !== undefined) {
      data.completed = input.status === 'COMPLETED';
    } else if (input.completed !== undefined) {
      data.status = input.completed ? 'COMPLETED' : 'TODO';
    }
    if (input.dueDate !== undefined) {
      data.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    }
    // Recompute startAt whenever dueDate or dueTime changes
    if (input.startAt !== undefined) {
      data.startAt = input.startAt ? new Date(input.startAt) : null;
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

    const todo = await prisma.todo.update({ where: { id: todoId, userId }, data });

    // Notify all logged-in devices to reschedule or cancel local alarm
    if (input.alarmAt !== undefined) {
      const tokens = await getTokensForUser(userId);
      if (tokens.length > 0) {
        if (input.alarmAt) {
          sendScheduleAlarmToDevices(tokens, todo.id, todo.title, new Date(input.alarmAt).toISOString(), 'task').catch(() => {});
        } else {
          sendCancelAlarmToDevices(tokens, todo.id).catch(() => {});
        }
      }
    }

    return mapTodo(todo);
  }

  async deleteTodo(userId: string, todoId: string): Promise<void> {
    const existing = await prisma.todo.findFirst({ where: { id: todoId, userId } });
    if (!existing) throw new AppError(404, 'Task not found');
    await prisma.todo.delete({ where: { id: todoId, userId } });
  }
}
