import { ExpenseCategory } from '@modules/expense/models/expense.model';

// Presupuestos usa exactamente las mismas categorías que Egresos, para que
// el gasto de cada categoría se pueda comparar 1 a 1 contra su presupuesto.
export type BudgetCategory = ExpenseCategory;

export const BUDGET_CATEGORIES: BudgetCategory[] = [
  'Alimentación',
  'Transporte',
  'Vivienda',
  'Servicios',
  'Otros',
  'Pequeños consumos',
];

export interface Budget {
  id: string;
  userId: string;
  category: BudgetCategory;
  monthlyAmount: number;
  createdAt: string;
  updatedAt: string;
}