import { OAuth2Client } from 'google-auth-library';
import { env } from '@config/env';

const client = new OAuth2Client(env.google.clientId);

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

/**
 * Verifica el ID token que llega desde el botón "Sign in with Google" del
 * frontend. Si es válido, devuelve los datos básicos del perfil de Google.
 * Si es inválido/expirado/de otra app, lanza un error.
 */
export class GoogleAuthService {
  static async verifyIdToken(idToken: string): Promise<GoogleProfile> {
    if (!env.google.clientId) {
      throw new Error('GOOGLE_CLIENT_ID_NOT_CONFIGURED');
    }

    const ticket = await client.verifyIdToken({
      idToken,
      audience: env.google.clientId,
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.sub || !payload.email) {
      throw new Error('GOOGLE_TOKEN_INVALID');
    }

    if (!payload.email_verified) {
      throw new Error('GOOGLE_EMAIL_NOT_VERIFIED');
    }

    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name || payload.email.split('@')[0],
      avatarUrl: payload.picture || null,
    };
  }
}