import { pool } from '@config/database';
import { Budget, BudgetCategory } from './budget.model';

export interface IBudgetRepository {
  findAllByUser(userId: string): Promise<Budget[]>;
  upsert(userId: string, category: BudgetCategory, monthlyAmount: number): Promise<Budget>;
}

const mapRow = (row: any): Budget => ({
  id: row.id,
  userId: row.user_id,
  category: row.category,
  monthlyAmount: Number(row.monthly_amount),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class PostgresBudgetRepository implements IBudgetRepository {
  async findAllByUser(userId: string): Promise<Budget[]> {
    const { rows } = await pool.query(
      `SELECT id, user_id, category, monthly_amount, created_at, updated_at
       FROM budgets WHERE user_id = $1`,
      [userId],
    );
    return rows.map(mapRow);
  }

  // "Crear o actualizar" en una sola instrucción: cada usuario tiene a lo
  // sumo una fila por categoría (constraint UNIQUE (user_id, category)).
  async upsert(userId: string, category: BudgetCategory, monthlyAmount: number): Promise<Budget> {
    const { rows } = await pool.query(
      `INSERT INTO budgets (user_id, category, monthly_amount, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id, category)
       DO UPDATE SET monthly_amount = EXCLUDED.monthly_amount, updated_at = now()
       RETURNING id, user_id, category, monthly_amount, created_at, updated_at`,
      [userId, category, monthlyAmount],
    );
    return mapRow(rows[0]);
  }
}

export const budgetRepository: IBudgetRepository = new PostgresBudgetRepository();