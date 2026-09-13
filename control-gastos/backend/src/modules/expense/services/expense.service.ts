import { expenseRepository } from '../models/expense.repository';
import { Expense, ExpenseCategory } from '../models/expense.model';
import { incomeRepository } from '@modules/income/models/income.repository';

// Error específico para cuando el egreso supera el saldo disponible
// (ingresos totales - egresos ya registrados). El controller lo detecta
// con "instanceof" y arma el mensaje que ve el usuario, incluyendo el
// saldo disponible real para que el mensaje sea claro y no genérico.
export class InsufficientBalanceError extends Error {
  constructor(public readonly available: number) {
    super('INSUFFICIENT_BALANCE');
    this.name = 'InsufficientBalanceError';
  }
}

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

// Fecha de HOY en el servidor, en formato YYYY-MM-DD (comparable como string
// porque el formato es ISO). Es un control de día por día: no se acepta
// ninguna fecha posterior al día actual (sí se acepta hoy o una fecha pasada).
const todayIso = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const isValidDateFormat = (date: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(date);

const validate = (dto: UpdateExpenseDto): void => {
  if (!dto.description || dto.description.trim().length < 3) throw new Error('DESCRIPTION_INVALID');
  if (!dto.amount || dto.amount <= 0) throw new Error('AMOUNT_INVALID');
  if (!VALID_CATEGORIES.includes(dto.category)) throw new Error('CATEGORY_INVALID');
  if (!dto.date || !isValidDateFormat(dto.date)) throw new Error('DATE_INVALID');
  if (dto.date > todayIso()) throw new Error('DATE_FUTURE_NOT_ALLOWED');
};

// Saldo disponible del usuario = total de ingresos - total de egresos ya
// registrados. Si excludeExpenseId viene informado (caso "editar"), ese
// egreso se excluye de la suma porque su monto anterior ya está contado
// dentro de los egresos existentes y no debe restarse dos veces.
const getAvailableBalance = async (userId: string, excludeExpenseId?: string): Promise<number> => {
  const [incomes, expenses] = await Promise.all([
    incomeRepository.findAllByUser(userId),
    expenseRepository.findAllByUser(userId),
  ]);

  const totalIngresos = incomes.reduce((sum, i) => sum + i.amount, 0);
  const totalEgresos = expenses
    .filter((e) => e.id !== excludeExpenseId)
    .reduce((sum, e) => sum + e.amount, 0);

  return totalIngresos - totalEgresos;
};

const ensureSufficientBalance = async (userId: string, amount: number, excludeExpenseId?: string): Promise<void> => {
  const available = await getAvailableBalance(userId, excludeExpenseId);
  if (amount > available) throw new InsufficientBalanceError(available);
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
    await ensureSufficientBalance(dto.userId, dto.amount);
    return expenseRepository.create(dto);
  }

  // El repositorio ya filtra por user_id en el UPDATE, pero además revisamos
  // aquí el resultado: si viene null, o el id no existe o no es del usuario.
  static async update(id: string, userId: string, dto: UpdateExpenseDto): Promise<Expense> {
    validate(dto);
    await ensureSufficientBalance(userId, dto.amount, id);
    const updated = await expenseRepository.update(id, userId, dto);
    if (!updated) throw new Error('EXPENSE_NOT_FOUND');
    return updated;
  }

  static async remove(id: string, userId: string): Promise<void> {
    const deleted = await expenseRepository.delete(id, userId);
    if (!deleted) throw new Error('EXPENSE_NOT_FOUND');
  }
}