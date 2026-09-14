import { Router } from 'express';
import { SmallExpenseGoalController } from '../controllers/small-expense-goal.controller';
import { authMiddleware } from '../../auth/middlewares/auth.middleware';

const router = Router();

// GET  /api/small-expense-goals  -> obtiene la meta del usuario autenticado (o el valor por defecto)
router.get('/', authMiddleware, SmallExpenseGoalController.get);

// PUT  /api/small-expense-goals  -> crea o actualiza la meta del usuario autenticado
router.put('/', authMiddleware, SmallExpenseGoalController.update);

export default router;