import { pool } from '@config/database';
import { SmallExpense, SmallExpenseCategory } from './small-expense.model';

export interface CreateSmallExpenseInput {
  userId: string;
  expenseId: string;
  description: string;
  category: SmallExpenseCategory;
  amount: number;
  method: string;
  date: string;
}

export type UpdateSmallExpenseInput = Omit<CreateSmallExpenseInput, 'userId' | 'expenseId'>;

export interface ISmallExpenseRepository {
  findAllByUser(userId: string): Promise<SmallExpense[]>;
  findByIdAndUser(id: string, userId: string): Promise<SmallExpense | null>;
  create(input: CreateSmallExpenseInput): Promise<SmallExpense>;
  update(id: string, userId: string, input: UpdateSmallExpenseInput): Promise<SmallExpense | null>;
  delete(id: string, userId: string): Promise<boolean>;
}

const mapRow = (row: any): SmallExpense => ({
  id: row.id,
  userId: row.user_id,
  expenseId: row.expense_id,
  description: row.description,
  category: row.category,
  amount: Number(row.amount),
  method: row.method,
  date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : row.date,
  createdAt: row.created_at,
});

export class PostgresSmallExpenseRepository implements ISmallExpenseRepository {
  async findAllByUser(userId: string): Promise<SmallExpense[]> {
    const { rows } = await pool.query(
      `SELECT id, user_id, expense_id, description, category, amount, method, date, created_at
       FROM small_expenses WHERE user_id = $1 ORDER BY date DESC, created_at DESC`,
      [userId],
    );
    return rows.map(mapRow);
  }

  // "expense_id" viene ya creado (el Egreso reflejo se crea PRIMERO desde el
  // servicio); aquí solo se guarda el enlace.
  async create(input: CreateSmallExpenseInput): Promise<SmallExpense> {
    const { rows } = await pool.query(
      `INSERT INTO small_expenses (user_id, expense_id, description, category, amount, method, date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, user_id, expense_id, description, category, amount, method, date, created_at`,
      [input.userId, input.expenseId, input.description, input.category, input.amount, input.method, input.date],
    );
    return mapRow(rows[0]);
  }

  async findByIdAndUser(id: string, userId: string): Promise<SmallExpense | null> {
    const { rows } = await pool.query(
      `SELECT id, user_id, expense_id, description, category, amount, method, date, created_at
       FROM small_expenses WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  // "expense_id" NO se actualiza aquí: el enlace con el Egreso reflejo no cambia.
  async update(id: string, userId: string, input: UpdateSmallExpenseInput): Promise<SmallExpense | null> {
    const { rows } = await pool.query(
      `UPDATE small_expenses
       SET description = $1, category = $2, amount = $3, method = $4, date = $5
       WHERE id = $6 AND user_id = $7
       RETURNING id, user_id, expense_id, description, category, amount, method, date, created_at`,
      [input.description, input.category, input.amount, input.method, input.date, id, userId],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await pool.query(`DELETE FROM small_expenses WHERE id = $1 AND user_id = $2`, [id, userId]);
    return (result.rowCount ?? 0) > 0;
  }
}

export const smallExpenseRepository: ISmallExpenseRepository = new PostgresSmallExpenseRepository();