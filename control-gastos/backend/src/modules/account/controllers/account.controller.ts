import { Request, Response } from 'express';
import { AccountService } from '../services/account.service';
import { ok, badRequest, unauthorized, serverError } from '@shared/utils/http-response';

export class AccountController {
  static async getProfile(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      const profile = await AccountService.getProfile(userId);
      return ok(res, profile, 'Perfil obtenido');
    } catch (error) {
      console.error(error);
      return serverError(res);
    }
  }

  static async updateName(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      const { name } = req.body;
      await AccountService.updateName(userId, name);
      const profile = await AccountService.getProfile(userId);
      return ok(res, profile, 'Nombre actualizado');
    } catch (error) {
      if (error instanceof Error && error.message === 'NAME_INVALID') {
        return badRequest(res, 'El nombre debe tener al menos 3 caracteres');
      }
      console.error(error);
      return serverError(res);
    }
  }

  static async changePassword(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      const { currentPassword, newPassword } = req.body;
      await AccountService.changePassword(userId, currentPassword, newPassword);
      return ok(res, null, 'Contraseña actualizada');
    } catch (error) {
      if (error instanceof Error && error.message === 'GOOGLE_ACCOUNT_NO_PASSWORD') {
        return badRequest(res, 'Tu cuenta usa Google para iniciar sesión y no tiene contraseña propia');
      }
      if (error instanceof Error && error.message === 'PASSWORD_TOO_SHORT') {
        return badRequest(res, 'La nueva contraseña debe tener al menos 8 caracteres');
      }
      if (error instanceof Error && error.message === 'CURRENT_PASSWORD_INVALID') {
        return unauthorized(res, 'La contraseña actual no es correcta');
      }
      console.error(error);
      return serverError(res);
    }
  }
}