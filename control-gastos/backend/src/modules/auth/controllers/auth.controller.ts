import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { ok, badRequest, unauthorized, serverError } from '@shared/utils/http-response';

/**
 * Controller: solo recibe la request, valida lo mínimo de forma,
 * delega en el service y arma la response. Sin lógica de negocio aquí.
 */
export class AuthController {
  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return badRequest(res, 'Correo y contraseña son obligatorios');
      }

      const result = await AuthService.login(email, password);
      return ok(res, result, 'Inicio de sesión exitoso');
    } catch (error) {
      if (error instanceof Error && error.message === 'CREDENTIALS_INVALID') {
        return unauthorized(res, 'Correo o contraseña incorrectos');
      }
      console.error(error);
      return serverError(res);
    }
  }

  static async google(req: Request, res: Response) {
    try {
      const { idToken } = req.body;

      if (!idToken) {
        return badRequest(res, 'idToken es obligatorio');
      }

      const result = await AuthService.loginWithGoogle(idToken);
      return ok(res, result, 'Inicio de sesión con Google exitoso');
    } catch (error) {
      if (error instanceof Error && error.message === 'GOOGLE_TOKEN_INVALID') {
        return unauthorized(res, 'Token de Google inválido');
      }
      if (error instanceof Error && error.message === 'GOOGLE_EMAIL_NOT_VERIFIED') {
        return unauthorized(res, 'Tu correo de Google no está verificado');
      }
      console.error(error);
      return serverError(res);
    }
  }

  /** Endpoint de ejemplo protegido, útil para probar el guard/middleware. */
  static async me(req: Request, res: Response) {
    return ok(res, (req as any).user, 'Usuario autenticado');
  }
}