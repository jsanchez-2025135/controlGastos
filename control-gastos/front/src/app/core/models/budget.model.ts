import { ExpenseCategory } from './expense.model';

// Presupuestos usa las mismas categorías que Egresos.
export type BudgetCategory = ExpenseCategory;

export const BUDGET_CATEGORIES: BudgetCategory[] = [
  'Alimentación',
  'Transporte',
  'Vivienda',
  'Servicios',
  'Otros',
  'Pequeños consumos',
];

export type BudgetStatus = 'En rango' | 'Cerca del límite' | 'Sobre el límite';

export interface BudgetCategoryView {
  category: BudgetCategory;
  monthlyAmount: number;
  spent: number;
  available: number;
  progressPercent: number;
  status: BudgetStatus;
}

export interface BudgetSummary {
  categories: BudgetCategoryView[];
  totalBudgeted: number;
  totalSpent: number;
  totalSpentLastMonth: number;
  totalAvailable: number;
  monthLabel: string;
}