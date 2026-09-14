import { smallExpenseGoalRepository } from '../models/small-expense-goal.repository';
import { SmallExpenseGoal } from '../models/small-expense-goal.model';

const DEFAULT_GOAL = 300;

export class SmallExpenseGoalService {
  // Si el usuario todavía no ha configurado una meta, devolvemos un valor
  // por defecto (no guardado en base de datos) para que el frontend siempre
  // tenga algo que mostrar, en vez de manejar "null" en la pantalla.
  static async get(userId: string): Promise<{ amount: number }> {
    const goal = await smallExpenseGoalRepository.findByUser(userId);
    return { amount: goal ? goal.amount : DEFAULT_GOAL };
  }

  static async update(userId: string, amount: number): Promise<SmallExpenseGoal> {
    if (!amount || amount <= 0) throw new Error('AMOUNT_INVALID');
    return smallExpenseGoalRepository.upsert(userId, amount);
  }
}