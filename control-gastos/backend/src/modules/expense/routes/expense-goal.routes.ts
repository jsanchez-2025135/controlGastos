import { Router } from 'express';
import { ExpenseGoalController } from '../controllers/expense-goal.controller';
import { authMiddleware } from '../../auth/middlewares/auth.middleware';

const router = Router();

// GET  /api/expense-goals  -> obtiene la meta del usuario autenticado (o el valor por defecto)
router.get('/', authMiddleware, ExpenseGoalController.get);

// PUT  /api/expense-goals  -> crea o actualiza la meta del usuario autenticado
router.put('/', authMiddleware, ExpenseGoalController.update);

export default router;