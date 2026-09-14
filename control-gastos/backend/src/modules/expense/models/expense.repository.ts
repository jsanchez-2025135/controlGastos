import { pool } from '@config/database';
import { Expense, ExpenseCategory } from './expense.model';

export interface CreateExpenseInput {
  userId: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  method: string;
  date: string;
}

export type UpdateExpenseInput = Omit<CreateExpenseInput, 'userId'>;

export interface IExpenseRepository {
  findAllByUser(userId: string): Promise<Expense[]>;
  findByIdAndUser(id: string, userId: string): Promise<Expense | null>;
  create(input: CreateExpenseInput): Promise<Expense>;
  update(id: string, userId: string, input: UpdateExpenseInput): Promise<Expense | null>;
  delete(id: string, userId: string): Promise<boolean>;
}

const mapRow = (row: any): Expense => ({
  id: row.id,
  userId: row.user_id,
  description: row.description,
  category: row.category,
  amount: Number(row.amount),
  method: row.method,
  date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : row.date,
  createdAt: row.created_at,
});

export class PostgresExpenseRepository implements IExpenseRepository {
  async findAllByUser(userId: string): Promise<Expense[]> {
    const { rows } = await pool.query(
      `SELECT id, user_id, description, category, amount, method, date, created_at
       FROM expenses WHERE user_id = $1 ORDER BY date DESC, created_at DESC`,
      [userId],
    );
    return rows.map(mapRow);
  }

  async create(input: CreateExpenseInput): Promise<Expense> {
    const { rows } = await pool.query(
      `INSERT INTO expenses (user_id, description, category, amount, method, date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id, description, category, amount, method, date, created_at`,
      [input.userId, input.description, input.category, input.amount, input.method, input.date],
    );
    return mapRow(rows[0]);
  }

  async findByIdAndUser(id: string, userId: string): Promise<Expense | null> {
    const { rows } = await pool.query(
      `SELECT id, user_id, description, category, amount, method, date, created_at
       FROM expenses WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  // El WHERE incluye user_id para que un usuario nunca pueda editar el egreso de otro,
  // aunque adivine el id.
  async update(id: string, userId: string, input: UpdateExpenseInput): Promise<Expense | null> {
    const { rows } = await pool.query(
      `UPDATE expenses
       SET description = $1, category = $2, amount = $3, method = $4, date = $5
       WHERE id = $6 AND user_id = $7
       RETURNING id, user_id, description, category, amount, method, date, created_at`,
      [input.description, input.category, input.amount, input.method, input.date, id, userId],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await pool.query(`DELETE FROM expenses WHERE id = $1 AND user_id = $2`, [id, userId]);
    return (result.rowCount ?? 0) > 0;
  }
}

export const expenseRepository: IExpenseRepository = new PostgresExpenseRepository();