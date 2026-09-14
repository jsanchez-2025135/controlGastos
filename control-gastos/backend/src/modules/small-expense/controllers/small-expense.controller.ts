import { Request, Response } from 'express';
import { SmallExpenseService, InsufficientBalanceError } from '../services/small-expense.service';
import { ok, created, badRequest, notFound, serverError } from '@shared/utils/http-response';

// Mismo formato de mensaje que usa Egresos, para que el usuario vea un
// mensaje consistente sin importar desde qué pantalla se rechazó.
const insufficientBalanceMessage = (available: number): string =>
  `No puedes registrar este consumo: tu saldo disponible es Q${available.toFixed(2)} y el monto ingresado lo supera.`;

export class SmallExpenseController {
  static async list(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      const summary = await SmallExpenseService.list(userId);
      return ok(res, summary, 'Pequeños consumos obtenidos');
    } catch (error) {
      console.error(error);
      return serverError(res);
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      const { description, category, amount, method, date } = req.body;

      const item = await SmallExpenseService.create({
        userId,
        description,
        category,
        amount: Number(amount),
        method,
        date,
      });

      return created(res, item, 'Consumo registrado');
    } catch (error) {
      if (error instanceof InsufficientBalanceError) {
        return badRequest(res, insufficientBalanceMessage(error.available));
      }
      if (error instanceof Error && error.message === 'DATE_FUTURE_NOT_ALLOWED') {
        return badRequest(res, 'No puedes registrar un consumo con fecha futura');
      }
      if (error instanceof Error && ['DESCRIPTION_INVALID', 'AMOUNT_INVALID', 'CATEGORY_INVALID', 'DATE_INVALID'].includes(error.message)) {
        return badRequest(res, 'Datos del consumo inválidos');
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

      const item = await SmallExpenseService.update(id, userId, {
        description,
        category,
        amount: Number(amount),
        method,
        date,
      });

      return ok(res, item, 'Consumo actualizado');
    } catch (error) {
      if (error instanceof InsufficientBalanceError) {
        return badRequest(res, insufficientBalanceMessage(error.available));
      }
      if (error instanceof Error && error.message === 'DATE_FUTURE_NOT_ALLOWED') {
        return badRequest(res, 'No puedes registrar un consumo con fecha futura');
      }
      if (error instanceof Error && ['DESCRIPTION_INVALID', 'AMOUNT_INVALID', 'CATEGORY_INVALID', 'DATE_INVALID'].includes(error.message)) {
        return badRequest(res, 'Datos del consumo inválidos');
      }
      if (error instanceof Error && error.message === 'SMALL_EXPENSE_NOT_FOUND') {
        return notFound(res, 'Consumo no encontrado');
      }
      console.error(error);
      return serverError(res);
    }
  }

  static async remove(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      const { id } = req.params;

      await SmallExpenseService.remove(id, userId);
      return ok(res, null, 'Consumo eliminado');
    } catch (error) {
      if (error instanceof Error && error.message === 'SMALL_EXPENSE_NOT_FOUND') {
        return notFound(res, 'Consumo no encontrado');
      }
      console.error(error);
      return serverError(res);
    }
  }
}