export type SmallExpenseCategory = 'Café' | 'Snacks' | 'Bebidas' | 'Panadería' | 'Otros';

export interface SmallExpense {
  id: string;
  userId: string;
  description: string;
  category: SmallExpenseCategory;
  amount: number;
  method: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
}

export interface SmallExpenseSummary {
  items: SmallExpense[];
  totalConsumos: number;
  totalByCategory: Record<SmallExpenseCategory, number>;
  count: number;
}

export interface CreateSmallExpensePayload {
  description: string;
  category: SmallExpenseCategory;
  amount: number;
  method: string;
  date: string;
}

export interface SmallExpense {
  id: string;
  userId: string;
  expenseId: string;
  description: string;
  category: SmallExpenseCategory;
  amount: number;
  method: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
}
export type UpdateSmallExpensePayload = CreateSmallExpensePayload;