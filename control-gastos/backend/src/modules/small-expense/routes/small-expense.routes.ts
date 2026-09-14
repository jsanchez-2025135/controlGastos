import { Router } from 'express';
import { SmallExpenseController } from '../controllers/small-expense.controller';
import { authMiddleware } from '../../auth/middlewares/auth.middleware';

const router = Router();

// GET  /api/small-expenses  -> lista + totales por categoría del usuario autenticado
router.get('/', authMiddleware, SmallExpenseController.list);

// POST /api/small-expenses  -> registra un nuevo consumo
router.post('/', authMiddleware, SmallExpenseController.create);

// PUT  /api/small-expenses/:id  -> edita un consumo existente del usuario autenticado
router.put('/:id', authMiddleware, SmallExpenseController.update);

// DELETE /api/small-expenses/:id  -> elimina un consumo del usuario autenticado
router.delete('/:id', authMiddleware, SmallExpenseController.remove);

export default router;