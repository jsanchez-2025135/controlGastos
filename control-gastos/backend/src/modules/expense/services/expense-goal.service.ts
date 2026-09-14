import { expenseGoalRepository } from '../models/expense-goal.repository';
import { ExpenseGoal } from '../models/expense-goal.model';

const DEFAULT_GOAL = 5000;

export class ExpenseGoalService {
  // Si el usuario todavía no ha configurado una meta, devolvemos un valor
  // por defecto (no guardado en base de datos) para que el frontend siempre
  // tenga algo que mostrar, en vez de manejar "null" en la pantalla.
  static async get(userId: string): Promise<{ amount: number }> {
    const goal = await expenseGoalRepository.findByUser(userId);
    return { amount: goal ? goal.amount : DEFAULT_GOAL };
  }

  static async update(userId: string, amount: number): Promise<ExpenseGoal> {
    if (!amount || amount <= 0) throw new Error('AMOUNT_INVALID');
    return expenseGoalRepository.upsert(userId, amount);
  }
}