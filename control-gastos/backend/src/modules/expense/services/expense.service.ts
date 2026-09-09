import { expenseRepository } from '../models/expense.repository';
import { Expense, ExpenseCategory } from '../models/expense.model';

const VALID_CATEGORIES: ExpenseCategory[] = ['Alimentación', 'Transporte', 'Vivienda', 'Servicios', 'Otros'];

interface CreateExpenseDto {
  userId: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  method: string;
  date: string;
}

type UpdateExpenseDto = Omit<CreateExpenseDto, 'userId'>;

const validate = (dto: UpdateExpenseDto): void => {
  if (!dto.description || dto.description.trim().length < 3) throw new Error('DESCRIPTION_INVALID');
  if (!dto.amount || dto.amount <= 0) throw new Error('AMOUNT_INVALID');
  if (!VALID_CATEGORIES.includes(dto.category)) throw new Error('CATEGORY_INVALID');
  if (!dto.date) throw new Error('DATE_INVALID');
};

export interface ExpenseSummary {
  expenses: Expense[];
  totalEgresos: number;
  totalByCategory: Record<ExpenseCategory, number>;
  count: number;
}

/**
 * Capa de servicio: valida y calcula los totales.
 * El controller solo la invoca; el repositorio solo hace queries.
 */
export class ExpenseService {
  static async list(userId: string): Promise<ExpenseSummary> {
    const expenses = await expenseRepository.findAllByUser(userId);

    const totalByCategory = VALID_CATEGORIES.reduce((acc, cat) => {
      acc[cat] = expenses.filter((e) => e.category === cat).reduce((sum, e) => sum + e.amount, 0);
      return acc;
    }, {} as Record<ExpenseCategory, number>);

    const totalEgresos = expenses.reduce((sum, e) => sum + e.amount, 0);

    return {
      expenses,
      totalEgresos,
      totalByCategory,
      count: expenses.length,
    };
  }

  static async create(dto: CreateExpenseDto): Promise<Expense> {
    validate(dto);
    return expenseRepository.create(dto);
  }

  // El repositorio ya filtra por user_id en el UPDATE, pero además revisamos
  // aquí el resultado: si viene null, o el id no existe o no es del usuario.
  static async update(id: string, userId: string, dto: UpdateExpenseDto): Promise<Expense> {
    validate(dto);
    const updated = await expenseRepository.update(id, userId, dto);
    if (!updated) throw new Error('EXPENSE_NOT_FOUND');
    return updated;
  }

  static async remove(id: string, userId: string): Promise<void> {
    const deleted = await expenseRepository.delete(id, userId);
    if (!deleted) throw new Error('EXPENSE_NOT_FOUND');
  }
}