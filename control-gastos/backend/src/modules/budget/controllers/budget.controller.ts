import { Request, Response } from 'express';
import { BudgetService } from '../services/budget.service';
import { ok, badRequest, serverError } from '@shared/utils/http-response';

export class BudgetController {
  static async list(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      const summary = await BudgetService.list(userId);
      return ok(res, summary, 'Presupuestos obtenidos');
    } catch (error) {
      console.error(error);
      return serverError(res);
    }
  }

  // PUT /api/budgets/:category  -> category viene en la URL, ej. "Alimentaci%C3%B3n"
  // Express ya la decodifica sola a "Alimentación" en req.params.category.
  static async setBudget(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      const { category } = req.params;
      const { monthlyAmount } = req.body;

      await BudgetService.setBudget(userId, category as any, Number(monthlyAmount));
      const summary = await BudgetService.list(userId);
      return ok(res, summary, 'Presupuesto actualizado');
    } catch (error) {
      if (error instanceof Error && error.message === 'CATEGORY_INVALID') {
        return badRequest(res, 'Categoría inválida');
      }
      if (error instanceof Error && error.message === 'AMOUNT_INVALID') {
        return badRequest(res, 'El monto del presupuesto debe ser mayor o igual a 0');
      }
      console.error(error);
      return serverError(res);
    }
  }
}