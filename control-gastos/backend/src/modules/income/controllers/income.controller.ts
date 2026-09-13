import { Request, Response } from 'express';
import { IncomeService } from '../services/income.service';
import { ok, created, badRequest, notFound, serverError } from '@shared/utils/http-response';

export class IncomeController {
  static async list(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      const summary = await IncomeService.list(userId);
      return ok(res, summary, 'Ingresos obtenidos');
    } catch (error) {
      console.error(error);
      return serverError(res);
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      const { title, type, category, amount, method, date } = req.body;

      const income = await IncomeService.create({
        userId,
        title,
        type,
        category,
        amount: Number(amount),
        method,
        date,
      });

      return created(res, income, 'Ingreso registrado');
    } catch (error) {
      if (error instanceof Error && error.message === 'DATE_FUTURE_NOT_ALLOWED') {
        return badRequest(res, 'No puedes registrar un ingreso con fecha futura');
      }
      if (error instanceof Error && ['TITLE_INVALID', 'AMOUNT_INVALID', 'TYPE_INVALID', 'DATE_INVALID'].includes(error.message)) {
        return badRequest(res, 'Datos del ingreso inválidos');
      }
      console.error(error);
      return serverError(res);
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      const { id } = req.params;
      const { title, type, category, amount, method, date } = req.body;

      const income = await IncomeService.update(id, userId, {
        title,
        type,
        category,
        amount: Number(amount),
        method,
        date,
      });

      return ok(res, income, 'Ingreso actualizado');
    } catch (error) {
      if (error instanceof Error && error.message === 'DATE_FUTURE_NOT_ALLOWED') {
        return badRequest(res, 'No puedes registrar un ingreso con fecha futura');
      }
      if (error instanceof Error && ['TITLE_INVALID', 'AMOUNT_INVALID', 'TYPE_INVALID', 'DATE_INVALID'].includes(error.message)) {
        return badRequest(res, 'Datos del ingreso inválidos');
      }
      if (error instanceof Error && error.message === 'INCOME_NOT_FOUND') {
        return notFound(res, 'Ingreso no encontrado');
      }
      console.error(error);
      return serverError(res);
    }
  }

  static async remove(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      const { id } = req.params;

      await IncomeService.remove(id, userId);
      return ok(res, null, 'Ingreso eliminado');
    } catch (error) {
      if (error instanceof Error && error.message === 'INCOME_NOT_FOUND') {
        return notFound(res, 'Ingreso no encontrado');
      }
      console.error(error);
      return serverError(res);
    }
  }
}