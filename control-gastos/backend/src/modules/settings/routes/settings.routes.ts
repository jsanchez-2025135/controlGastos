import { Router } from 'express';
import { SettingsController } from '../controllers/settings.controller';
import { authMiddleware } from '../../auth/middlewares/auth.middleware';

const router = Router();

router.get('/', authMiddleware, SettingsController.get);
router.put('/', authMiddleware, SettingsController.update);

export default router;