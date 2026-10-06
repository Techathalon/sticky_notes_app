import { notesApi } from '../services/api';
import type { ExpenseCategory } from '../store/expenseStore';

export interface DetectedExpense {
  amount: number;
  title: string;
  category: ExpenseCategory;
  snippet: string;
  date?: string;
}

const VALID_CATEGORIES: ExpenseCategory[] = ['Food', 'Transport', 'Shopping', 'Health', 'Bills', 'Other'];

export async function detectAllExpenses(text: string): Promise<DetectedExpense[]> {
  if (!text.trim()) return [];
  try {
    const results = await notesApi.detectExpenses(text);
    console.log('Detected expenses:', results);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return results
      .filter((item) => VALID_CATEGORIES.includes(item.category as ExpenseCategory))
      .filter((item) => {
        if (!item.date) return true;
        const d = new Date(item.date);
        return !isNaN(d.getTime()) && d <= today;
      })
      .map((item) => ({
        amount: item.amount,
        title: item.title,
        category: item.category as ExpenseCategory,
        snippet: item.snippet,
        date: item.date,
      }));
  } catch {
    return [];
  }
}
