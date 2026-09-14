import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import { authMiddleware } from '../../auth/middlewares/auth.middleware';

const router = Router();

router.get('/', authMiddleware, NotificationController.list);
router.patch('/:id/read', authMiddleware, NotificationController.markAsRead);
router.patch('/read-all', authMiddleware, NotificationController.markAllAsRead);
router.delete('/:id', authMiddleware, NotificationController.remove);
export default router;