import { budgetRepository } from '../models/budget.repository';
import { BUDGET_CATEGORIES, BudgetCategory } from '../models/budget.model';
import { expenseRepository } from '@modules/expense/models/expense.repository';

export type BudgetStatus = 'En rango' | 'Cerca del límite' | 'Sobre el límite';

export interface BudgetCategoryView {
  category: BudgetCategory;
  monthlyAmount: number;
  spent: number;
  available: number;
  progressPercent: number; // puede superar 100 si el gasto rebasó el presupuesto
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

const monthLabel = (): string => {
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const now = new Date();
  return `${meses[now.getMonth()]} ${now.getFullYear()}`;
};

const statusFor = (percent: number): BudgetStatus => {
  if (percent >= 100) return 'Sobre el límite';
  if (percent >= 80) return 'Cerca del límite';
  return 'En rango';
};

/**
 * Capa de servicio: junta el presupuesto configurado de cada categoría
 * (tabla "budgets") con lo realmente gastado ESTE MES en esa categoría
 * (tabla "expenses", que ya incluye los reflejos de Pequeños Consumos).
 */
export class BudgetService {
 static async list(userId: string): Promise<BudgetSummary> {
    const [budgets, expenses] = await Promise.all([
      budgetRepository.findAllByUser(userId),
      expenseRepository.findAllByUser(userId),
    ]);

    const now = new Date();
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

    const thisMonthExpenses = expenses.filter((e) => e.date.slice(0, 7) === thisMonthKey);
    const lastMonthExpenses = expenses.filter((e) => e.date.slice(0, 7) === lastMonthKey);

    const budgetByCategory = new Map(budgets.map((b) => [b.category, b.monthlyAmount]));

    // Siempre se devuelven las 6 categorías, aunque el usuario nunca haya
    // configurado un presupuesto para alguna (queda en Q0.00, editable).
    const categories: BudgetCategoryView[] = BUDGET_CATEGORIES.map((category) => {
      const monthlyAmount = budgetByCategory.get(category) ?? 0;
      const spent = thisMonthExpenses.filter((e) => e.category === category).reduce((sum, e) => sum + e.amount, 0);
      const available = monthlyAmount - spent;
      const progressPercent = monthlyAmount > 0 ? Math.round((spent / monthlyAmount) * 100) : spent > 0 ? 100 : 0;

      return { category, monthlyAmount, spent, available, progressPercent, status: statusFor(progressPercent) };
    });

    const totalBudgeted = categories.reduce((sum, c) => sum + c.monthlyAmount, 0);
    const totalSpent = categories.reduce((sum, c) => sum + c.spent, 0);
    const totalSpentLastMonth = lastMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

    return {
      categories,
      totalBudgeted,
      totalSpent,
      totalSpentLastMonth,
      totalAvailable: totalBudgeted - totalSpent,
      monthLabel: monthLabel(),
    };
  }

  static async setBudget(userId: string, category: BudgetCategory, monthlyAmount: number): Promise<void> {
    if (!BUDGET_CATEGORIES.includes(category)) throw new Error('CATEGORY_INVALID');
    if (monthlyAmount === undefined || monthlyAmount === null || monthlyAmount < 0) throw new Error('AMOUNT_INVALID');
    await budgetRepository.upsert(userId, category, monthlyAmount);
  }
}