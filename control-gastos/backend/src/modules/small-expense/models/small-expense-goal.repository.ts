import { pool } from '@config/database';
import { SmallExpenseGoal } from './small-expense-goal.model';

export interface ISmallExpenseGoalRepository {
  findByUser(userId: string): Promise<SmallExpenseGoal | null>;
  upsert(userId: string, amount: number): Promise<SmallExpenseGoal>;
}

const mapRow = (row: any): SmallExpenseGoal => ({
  userId: row.user_id,
  amount: Number(row.amount),
  updatedAt: row.updated_at,
});

export class PostgresSmallExpenseGoalRepository implements ISmallExpenseGoalRepository {
  async findByUser(userId: string): Promise<SmallExpenseGoal | null> {
    const { rows } = await pool.query(
      `SELECT user_id, amount, updated_at FROM small_expense_goals WHERE user_id = $1`,
      [userId],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  // "Crear o actualizar" en una sola instrucción, igual que expense_goals.
  async upsert(userId: string, amount: number): Promise<SmallExpenseGoal> {
    const { rows } = await pool.query(
      `INSERT INTO small_expense_goals (user_id, amount, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (user_id)
       DO UPDATE SET amount = EXCLUDED.amount, updated_at = now()
       RETURNING user_id, amount, updated_at`,
      [userId, amount],
    );
    return mapRow(rows[0]);
  }
}

export const smallExpenseGoalRepository: ISmallExpenseGoalRepository = new PostgresSmallExpenseGoalRepository();