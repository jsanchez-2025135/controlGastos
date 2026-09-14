import { Router } from 'express';
import { BudgetController } from '../controllers/budget.controller';
import { authMiddleware } from '../../auth/middlewares/auth.middleware';

const router = Router();

// GET /api/budgets  -> las 6 categorías con presupuesto, gasto, disponible y estado
router.get('/', authMiddleware, BudgetController.list);

// PUT /api/budgets/:category  -> crea o actualiza el presupuesto de una categoría
router.put('/:category', authMiddleware, BudgetController.setBudget);

export default router;