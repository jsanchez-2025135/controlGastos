import { Router } from 'express';
import { ExpenseController } from '../controllers/expense.controller';
import { authMiddleware } from '../../auth/middlewares/auth.middleware';

const router = Router();

// GET  /api/expenses  -> lista + totales por categoría del usuario autenticado
router.get('/', authMiddleware, ExpenseController.list);

// POST /api/expenses  -> registra un nuevo egreso
router.post('/', authMiddleware, ExpenseController.create);

// PUT  /api/expenses/:id  -> edita un egreso existente del usuario autenticado
router.put('/:id', authMiddleware, ExpenseController.update);

// DELETE /api/expenses/:id  -> elimina un egreso del usuario autenticado
router.delete('/:id', authMiddleware, ExpenseController.remove);

export default router;