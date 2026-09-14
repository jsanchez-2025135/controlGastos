import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// POST /api/auth/login
router.post('/login', AuthController.login);
router.post('/google', AuthController.google);

// GET /api/auth/me  (ejemplo de ruta protegida, requiere token válido)
router.get('/me', authMiddleware, AuthController.me);

export default router;
