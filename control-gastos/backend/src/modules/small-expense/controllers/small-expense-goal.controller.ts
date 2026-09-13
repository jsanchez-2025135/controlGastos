import { Request, Response } from 'express';
import { SmallExpenseGoalService } from '../services/small-expense-goal.service';
import { ok, badRequest, serverError } from '@shared/utils/http-response';

export class SmallExpenseGoalController {
  static async get(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      const goal = await SmallExpenseGoalService.get(userId);
      return ok(res, goal, 'Meta de pequeños consumos obtenida');
    } catch (error) {
      console.error(error);
      return serverError(res);
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      const { amount } = req.body;

      const goal = await SmallExpenseGoalService.update(userId, Number(amount));
      return ok(res, goal, 'Meta de pequeños consumos actualizada');
    } catch (error) {
      if (error instanceof Error && error.message === 'AMOUNT_INVALID') {
        return badRequest(res, 'El monto de la meta debe ser mayor a 0');
      }
      console.error(error);
      return serverError(res);
    }
  }
}