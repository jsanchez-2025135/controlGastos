import { smallExpenseRepository } from '../models/small-expense.repository';
import { SmallExpense, SmallExpenseCategory } from '../models/small-expense.model';
import { ExpenseService, InsufficientBalanceError } from '@modules/expense/services/expense.service';

// Re-exportado para que el controller pueda detectar el error de saldo
// insuficiente sin importar directamente del módulo "expense".
export { InsufficientBalanceError };

const VALID_CATEGORIES: SmallExpenseCategory[] = ['Café', 'Snacks', 'Bebidas', 'Panadería', 'Otros'];

// Categoría fija con la que cada consumo pequeño aparece reflejado
// dentro de Egresos.
const LINKED_EXPENSE_CATEGORY = 'Pequeños consumos' as const;

interface CreateSmallExpenseDto {
  userId: string;
  description: string;
  category: SmallExpenseCategory;
  amount: number;
  method: string;
  date: string;
}

type UpdateSmallExpenseDto = Omit<CreateSmallExpenseDto, 'userId'>;

const todayIso = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const isValidDateFormat = (date: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(date);

const validate = (dto: UpdateSmallExpenseDto): void => {
  if (!dto.description || dto.description.trim().length < 3) throw new Error('DESCRIPTION_INVALID');
  if (!dto.amount || dto.amount <= 0) throw new Error('AMOUNT_INVALID');
  if (!VALID_CATEGORIES.includes(dto.category)) throw new Error('CATEGORY_INVALID');
  if (!dto.date || !isValidDateFormat(dto.date)) throw new Error('DATE_INVALID');
  if (dto.date > todayIso()) throw new Error('DATE_FUTURE_NOT_ALLOWED');
};

export interface SmallExpenseSummary {
  items: SmallExpense[];
  totalConsumos: number;
  totalByCategory: Record<SmallExpenseCategory, number>;
  count: number;
}

/**
 * Capa de servicio: valida, calcula los totales, y mantiene sincronizado
 * el Egreso reflejo de cada consumo pequeño (misma fila lógica en las dos
 * pantallas, enlazada por "expenseId").
 */
export class SmallExpenseService {
  static async list(userId: string): Promise<SmallExpenseSummary> {
    const items = await smallExpenseRepository.findAllByUser(userId);

    const totalByCategory = VALID_CATEGORIES.reduce((acc, cat) => {
      acc[cat] = items.filter((e) => e.category === cat).reduce((sum, e) => sum + e.amount, 0);
      return acc;
    }, {} as Record<SmallExpenseCategory, number>);

    const totalConsumos = items.reduce((sum, e) => sum + e.amount, 0);

    return { items, totalConsumos, totalByCategory, count: items.length };
  }

  // 1) Crea primero el Egreso reflejo (valida saldo disponible igual que un
  //    egreso normal; si no alcanza, lanza InsufficientBalanceError y aquí
  //    no se guarda nada).
  // 2) Con el id de ese Egreso ya creado, guarda el consumo pequeño enlazado.
  static async create(dto: CreateSmallExpenseDto): Promise<SmallExpense> {
    validate(dto);

    const linkedExpense = await ExpenseService.create({
      userId: dto.userId,
      description: dto.description,
      category: LINKED_EXPENSE_CATEGORY,
      amount: dto.amount,
      method: dto.method,
      date: dto.date,
    });

    return smallExpenseRepository.create({ ...dto, expenseId: linkedExpense.id });
  }

  // Actualiza el Egreso reflejo (con el mismo control de saldo disponible,
  // excluyendo su propio monto actual) y luego el consumo pequeño.
  static async update(id: string, userId: string, dto: UpdateSmallExpenseDto): Promise<SmallExpense> {
    validate(dto);

    const existing = await smallExpenseRepository.findByIdAndUser(id, userId);
    if (!existing) throw new Error('SMALL_EXPENSE_NOT_FOUND');

    await ExpenseService.update(existing.expenseId, userId, {
      description: dto.description,
      category: LINKED_EXPENSE_CATEGORY,
      amount: dto.amount,
      method: dto.method,
      date: dto.date,
    });

    const updated = await smallExpenseRepository.update(id, userId, dto);
    if (!updated) throw new Error('SMALL_EXPENSE_NOT_FOUND');
    return updated;
  }

  // Borra el Egreso reflejo; el ON DELETE CASCADE de la base de datos
  // elimina automáticamente la fila de small_expenses enlazada.
  static async remove(id: string, userId: string): Promise<void> {
    const existing = await smallExpenseRepository.findByIdAndUser(id, userId);
    if (!existing) throw new Error('SMALL_EXPENSE_NOT_FOUND');

    await ExpenseService.remove(existing.expenseId, userId);
  }
}