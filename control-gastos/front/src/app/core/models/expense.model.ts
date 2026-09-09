export type ExpenseCategory = 'Alimentación' | 'Transporte' | 'Vivienda' | 'Servicios' | 'Otros';

export interface Expense {
  id: string;
  userId: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  method: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
}

export interface ExpenseSummary {
  expenses: Expense[];
  totalEgresos: number;
  totalByCategory: Record<ExpenseCategory, number>;
  count: number;
}

export interface CreateExpensePayload {
  description: string;
  category: ExpenseCategory;
  amount: number;
  method: string;
  date: string;
}

export type UpdateExpensePayload = CreateExpensePayload;