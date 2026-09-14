import { Request, Response } from 'express';
import { ExpenseService, InsufficientBalanceError } from '../services/expense.service';
import { ok, created, badRequest, notFound, serverError } from '@shared/utils/http-response';

// Mensaje que ve el usuario cuando un egreso supera su saldo disponible.
// Incluye el monto disponible real (ingresos - egresos) para que quede
// claro por qué se rechazó, no solo que "algo salió mal".
const insufficientBalanceMessage = (available: number): string =>
  `No puedes registrar este egreso: tu saldo disponible es Q${available.toFixed(2)} y el monto ingresado lo supera.`;

export class ExpenseController {
  static async list(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      const summary = await ExpenseService.list(userId);
      return ok(res, summary, 'Egresos obtenidos');
    } catch (error) {
      console.error(error);
      return serverError(res);
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      const { description, category, amount, method, date } = req.body;

      const expense = await ExpenseService.create({
        userId,
        description,
        category,
        amount: Number(amount),
        method,
        date,
      });

      return created(res, expense, 'Egreso registrado');
    } catch (error) {
      if (error instanceof InsufficientBalanceError) {
        return badRequest(res, insufficientBalanceMessage(error.available));
      }
      if (error instanceof Error && error.message === 'DATE_FUTURE_NOT_ALLOWED') {
        return badRequest(res, 'No puedes registrar un egreso con fecha futura');
      }
      if (error instanceof Error && ['DESCRIPTION_INVALID', 'AMOUNT_INVALID', 'CATEGORY_INVALID', 'DATE_INVALID'].includes(error.message)) {
        return badRequest(res, 'Datos del egreso inválidos');
      }
      console.error(error);
      return serverError(res);
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      const { id } = req.params;
      const { description, category, amount, method, date } = req.body;

      const expense = await ExpenseService.update(id, userId, {
        description,
        category,
        amount: Number(amount),
        method,
        date,
      });

      return ok(res, expense, 'Egreso actualizado');
    } catch (error) {
      if (error instanceof InsufficientBalanceError) {
        return badRequest(res, insufficientBalanceMessage(error.available));
      }
      if (error instanceof Error && error.message === 'DATE_FUTURE_NOT_ALLOWED') {
        return badRequest(res, 'No puedes registrar un egreso con fecha futura');
      }
      if (error instanceof Error && ['DESCRIPTION_INVALID', 'AMOUNT_INVALID', 'CATEGORY_INVALID', 'DATE_INVALID'].includes(error.message)) {
        return badRequest(res, 'Datos del egreso inválidos');
      }
      if (error instanceof Error && error.message === 'EXPENSE_NOT_FOUND') {
        return notFound(res, 'Egreso no encontrado');
      }
      console.error(error);
      return serverError(res);
    }
  }

  static async remove(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      const { id } = req.params;

      await ExpenseService.remove(id, userId);
      return ok(res, null, 'Egreso eliminado');
    } catch (error) {
      if (error instanceof Error && error.message === 'EXPENSE_NOT_FOUND') {
        return notFound(res, 'Egreso no encontrado');
      }
      console.error(error);
      return serverError(res);
    }
  }
}