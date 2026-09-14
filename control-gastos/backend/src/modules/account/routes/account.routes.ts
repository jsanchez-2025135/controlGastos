import { Router } from 'express';
import { AccountController } from '../controllers/account.controller';
import { authMiddleware } from '../../auth/middlewares/auth.middleware';

const router = Router();

router.get('/', authMiddleware, AccountController.getProfile);
router.put('/', authMiddleware, AccountController.updateName);
router.put('/password', authMiddleware, AccountController.changePassword);

export default router;