import { incomeRepository } from '../models/income.repository';
import { Income, IncomeType } from '../models/income.model';

interface CreateIncomeDto {
  userId: string;
  title: string;
  type: IncomeType;
  category: string;
  amount: number;
  method: string;
  date: string;
}

type UpdateIncomeDto = Omit<CreateIncomeDto, 'userId'>;

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

const validate = (dto: UpdateIncomeDto): void => {
  if (!dto.title || dto.title.trim().length < 3) throw new Error('TITLE_INVALID');
  if (!dto.amount || dto.amount <= 0) throw new Error('AMOUNT_INVALID');
  if (dto.type !== 'Fijo' && dto.type !== 'Variable') throw new Error('TYPE_INVALID');
  if (!dto.date || !isValidDateFormat(dto.date)) throw new Error('DATE_INVALID');
  if (dto.date > todayIso()) throw new Error('DATE_FUTURE_NOT_ALLOWED');
};

export interface IncomeSummary {
  incomes: Income[];
  totalIngresos: number;
  totalFixed: number;
  totalVariable: number;
  count: number;
}

/**
 * Capa de servicio: valida y calcula los totales.
 * El controller solo la invoca; el repositorio solo hace queries.
 */
export class IncomeService {
  static async list(userId: string): Promise<IncomeSummary> {
    const incomes = await incomeRepository.findAllByUser(userId);
    const totalFixed = incomes.filter((i) => i.type === 'Fijo').reduce((sum, i) => sum + i.amount, 0);
    const totalVariable = incomes.filter((i) => i.type === 'Variable').reduce((sum, i) => sum + i.amount, 0);

    return {
      incomes,
      totalIngresos: totalFixed + totalVariable,
      totalFixed,
      totalVariable,
      count: incomes.length,
    };
  }

  static async create(dto: CreateIncomeDto): Promise<Income> {
    validate(dto);
    return incomeRepository.create(dto);
  }

  // El repositorio ya filtra por user_id en el UPDATE, pero además revisamos
  // aquí el resultado: si viene null, o el id no existe o no es del usuario.
  static async update(id: string, userId: string, dto: UpdateIncomeDto): Promise<Income> {
    validate(dto);
    const updated = await incomeRepository.update(id, userId, dto);
    if (!updated) throw new Error('INCOME_NOT_FOUND');
    return updated;
  }

  static async remove(id: string, userId: string): Promise<void> {
    const deleted = await incomeRepository.delete(id, userId);
    if (!deleted) throw new Error('INCOME_NOT_FOUND');
  }
}