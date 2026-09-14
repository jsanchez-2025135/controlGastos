import { pool } from '@config/database';
import { ExpenseGoal } from './expense-goal.model';

export interface IExpenseGoalRepository {
  findByUser(userId: string): Promise<ExpenseGoal | null>;
  upsert(userId: string, amount: number): Promise<ExpenseGoal>;
}

const mapRow = (row: any): ExpenseGoal => ({
  userId: row.user_id,
  amount: Number(row.amount),
  updatedAt: row.updated_at,
});

export class PostgresExpenseGoalRepository implements IExpenseGoalRepository {
  async findByUser(userId: string): Promise<ExpenseGoal | null> {
    const { rows } = await pool.query(
      `SELECT user_id, amount, updated_at FROM expense_goals WHERE user_id = $1`,
      [userId],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  // "Crear o actualizar" en una sola instrucción: si el usuario ya tiene
  // fila en expense_goals, la actualiza; si no, la crea. Gracias a que
  // user_id es PRIMARY KEY, Postgres puede resolver el conflicto solo.
  async upsert(userId: string, amount: number): Promise<ExpenseGoal> {
    const { rows } = await pool.query(
      `INSERT INTO expense_goals (user_id, amount, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (user_id)
       DO UPDATE SET amount = EXCLUDED.amount, updated_at = now()
       RETURNING user_id, amount, updated_at`,
      [userId, amount],
    );
    return mapRow(rows[0]);
  }
}

export const expenseGoalRepository: IExpenseGoalRepository = new PostgresExpenseGoalRepository();