import { Expense } from '@repo/types';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { sendPushNotification } from './push.service';
import { CreateExpenseInput, UpdateExpenseInput, UpdateExpenseSettingsInput } from '../validation/expense.schema';

function mapExpense(e: {
  id: string; title: string; amount: number; category: string;
  date: string; noteId?: string | null; source?: string;
  userId: string; createdAt: Date; updatedAt: Date;
}): Expense {
  return {
    id: e.id,
    title: e.title,
    amount: e.amount,
    category: e.category as Expense['category'],
    date: e.date,
    noteId: e.noteId ?? null,
    source: (e.source ?? 'manual') as 'manual' | 'note',
    userId: e.userId,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

export class ExpensesService {
  async getExpenses(userId: string): Promise<Expense[]> {
    const expenses = await prisma.expense.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
    });
    return expenses.map(mapExpense);
  }

  async createExpense(userId: string, input: CreateExpenseInput): Promise<Expense> {
    const expense = await prisma.expense.create({
      data: { ...input, userId },
    });

    // Check budget alert thresholds after adding expense
    await this.checkBudgetAlerts(userId, input.date.slice(0, 7), expense.amount);

    return mapExpense(expense);
  }

  private async checkBudgetAlerts(userId: string, month: string, newExpenseAmount: number): Promise<void> {
    try {
      const [settings, budget, allExpenses] = await Promise.all([
        prisma.userAppSettings.findUnique({ where: { userId } }),
        prisma.budget.findUnique({ where: { userId_month: { userId, month } } }),
        prisma.expense.findMany({ where: { userId, date: { startsWith: month } } }),
      ]);

      if (!settings || !budget || budget.amount <= 0) return;

      const tokens = await prisma.deviceToken.findMany({ where: { userId } });
      if (tokens.length === 0) return;
      const deviceTokens = tokens.map((t) => t.token);

      const totalAfter  = allExpenses.reduce((s: number, e: { amount: number }) => s + e.amount, 0);
      const totalBefore = totalAfter - newExpenseAmount;
      const pct80       = budget.amount * 0.8;

      if (settings.budget80AlertEnabled && totalBefore < pct80 && totalAfter >= pct80) {
        await sendPushNotification(
          deviceTokens,
          '⚠️ Budget Alert',
          `You've used 80% of your ${month} budget`,
          { type: 'budget_80', month },
        );
      }

      if (settings.budget100AlertEnabled && totalBefore < budget.amount && totalAfter >= budget.amount) {
        await sendPushNotification(
          deviceTokens,
          '🚨 Budget Exceeded',
          `You've exceeded your ${month} budget`,
          { type: 'budget_100', month },
        );
      }
    } catch (err) {
      console.error('[expenses] Budget alert check failed:', err);
    }
  }

  async updateExpense(userId: string, expenseId: string, input: UpdateExpenseInput): Promise<Expense> {
    const existing = await prisma.expense.findFirst({ where: { id: expenseId, userId } });
    if (!existing) throw new AppError(404, 'Expense not found');
    const expense = await prisma.expense.update({ where: { id: expenseId, userId }, data: input });
    return mapExpense(expense);
  }

  async deleteExpense(userId: string, expenseId: string): Promise<void> {
    const existing = await prisma.expense.findFirst({ where: { id: expenseId, userId } });
    if (!existing) throw new AppError(404, 'Expense not found');
    await prisma.expense.delete({ where: { id: expenseId, userId } });
  }

  async getBudget(userId: string, month: string): Promise<number> {
    const budget = await prisma.budget.findUnique({ where: { userId_month: { userId, month } } });
    return budget?.amount ?? 0;
  }

  async setBudget(userId: string, month: string, amount: number): Promise<number> {
    const budget = await prisma.budget.upsert({
      where: { userId_month: { userId, month } },
      update: { amount },
      create: { userId, month, amount },
    });
    return budget.amount;
  }

  async getExpenseSettings(userId: string) {
    const settings = await prisma.userAppSettings.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    return {
      summaryEnabled:        settings.expenseSummaryEnabled,
      summaryTime:           settings.expenseSummaryTime,
      budget80AlertEnabled:  settings.budget80AlertEnabled,
      budget100AlertEnabled: settings.budget100AlertEnabled,
    };
  }

  async updateExpenseSettings(userId: string, input: UpdateExpenseSettingsInput) {
    const settings = await prisma.userAppSettings.upsert({
      where: { userId },
      update: {
        expenseSummaryEnabled: input.summaryEnabled,
        expenseSummaryTime:    input.summaryTime,
        budget80AlertEnabled:  input.budget80AlertEnabled,
        budget100AlertEnabled: input.budget100AlertEnabled,
      },
      create: {
        userId,
        expenseSummaryEnabled: input.summaryEnabled,
        expenseSummaryTime:    input.summaryTime,
        budget80AlertEnabled:  input.budget80AlertEnabled,
        budget100AlertEnabled: input.budget100AlertEnabled,
      },
    });
    return {
      summaryEnabled:        settings.expenseSummaryEnabled,
      summaryTime:           settings.expenseSummaryTime,
      budget80AlertEnabled:  settings.budget80AlertEnabled,
      budget100AlertEnabled: settings.budget100AlertEnabled,
    };
  }
}
