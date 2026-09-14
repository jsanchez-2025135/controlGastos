import { AuthUser } from './user.model';

export interface AccountProfile {
  user: AuthUser;
  hasPassword: boolean;
  accessMethod: 'Contraseña' | 'Google';
  totalTransacciones: number;
}

export interface UpdateNamePayload {
  name: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}