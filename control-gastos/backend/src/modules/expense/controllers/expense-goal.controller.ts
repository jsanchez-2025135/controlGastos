import { Request, Response } from 'express';
import { ExpenseGoalService } from '../services/expense-goal.service';
import { ok, badRequest, serverError } from '@shared/utils/http-response';

export class ExpenseGoalController {
  static async get(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      const goal = await ExpenseGoalService.get(userId);
      return ok(res, goal, 'Meta de egresos obtenida');
    } catch (error) {
      console.error(error);
      return serverError(res);
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      const { amount } = req.body;

      const goal = await ExpenseGoalService.update(userId, Number(amount));
      return ok(res, goal, 'Meta de egresos actualizada');
    } catch (error) {
      if (error instanceof Error && error.message === 'AMOUNT_INVALID') {
        return badRequest(res, 'El monto de la meta debe ser mayor a 0');
      }
      console.error(error);
      return serverError(res);
    }
  }
}