import { Request, Response } from 'express';
import { NotificationService } from '../services/notification.service';
import { ok, notFound, serverError } from '@shared/utils/http-response';

export class NotificationController {
  static async list(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      const summary = await NotificationService.list(userId);
      return ok(res, summary, 'Notificaciones obtenidas');
    } catch (error) {
      console.error(error);
      return serverError(res);
    }
  }

  static async markAsRead(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      const { id } = req.params;
      await NotificationService.markAsRead(id, userId);
      return ok(res, null, 'Notificación marcada como leída');
    } catch (error) {
      if (error instanceof Error && error.message === 'NOTIFICATION_NOT_FOUND') {
        return notFound(res, 'Notificación no encontrada');
      }
      console.error(error);
      return serverError(res);
    }
  }

  static async markAllAsRead(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      await NotificationService.markAllAsRead(userId);
      return ok(res, null, 'Todas las notificaciones marcadas como leídas');
    } catch (error) {
      console.error(error);
      return serverError(res);
    }
  }

  static async remove(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      const { id } = req.params;
      await NotificationService.remove(id, userId);
      return ok(res, null, 'Notificación eliminada');
    } catch (error) {
      if (error instanceof Error && error.message === 'NOTIFICATION_NOT_FOUND') {
        return notFound(res, 'Notificación no encontrada');
      }
      console.error(error);
      return serverError(res);
    }
  }
}