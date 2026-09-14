import { Request, Response, NextFunction } from 'express';
import { TokenService } from '../services/token.service';
import { unauthorized } from '@shared/utils/http-response';

/**
 * Verifica que la request traiga un JWT válido en el header:
 *   Authorization: Bearer <token>
 * Si es válido, agrega el payload decodificado a "req.user" y además
 * emite un token NUEVO (con la expiración reiniciada) en el header
 * "X-New-Token", para implementar sesión deslizante ("sliding session").
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorized(res, 'Token no proporcionado');
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = TokenService.verifyToken(token);
    (req as any).user = payload;

    // Renueva el token en cada petición autenticada (sesión deslizante).
    const { iat, exp, ...cleanPayload } = payload as any;
    const refreshedToken = TokenService.generateToken(cleanPayload);
    res.setHeader('X-New-Token', refreshedToken);

    next();
  } catch {
    return unauthorized(res, 'Token inválido o expirado');
  }
};