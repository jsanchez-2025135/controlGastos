import { Request, Response } from 'express';
import { SettingsService } from '../services/settings.service';
import { ok, serverError } from '@shared/utils/http-response';

export class SettingsController {
  static async get(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      const settings = await SettingsService.get(userId);
      return ok(res, settings, 'Preferencias obtenidas');
    } catch (error) {
      console.error(error);
      return serverError(res);
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      const { notifyRecordatorio, notifyTransaccion, notifyReporte, notifySistema } = req.body;

      const updated = await SettingsService.update(userId, {
        notifyRecordatorio: !!notifyRecordatorio,
        notifyTransaccion: !!notifyTransaccion,
        notifyReporte: !!notifyReporte,
        notifySistema: !!notifySistema,
      });

      return ok(res, updated, 'Preferencias actualizadas');
    } catch (error) {
      console.error(error);
      return serverError(res);
    }
  }
}