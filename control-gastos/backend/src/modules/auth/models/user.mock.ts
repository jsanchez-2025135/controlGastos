import { User } from './user.model';

/**
 * MOCK de usuarios en memoria.
 *
 * Esto reemplaza temporalmente a la tabla "users" de PostgreSQL.
 * Las contraseñas NO están en texto plano: ya vienen hasheadas con bcrypt.
 *
 * Credenciales de prueba:
 *   Admin -> email: admin@controlgastos.com | password: Admin123!
 *   User  -> email: user@controlgastos.com  | password: User123!
 */
export const usersMock: User[] = [
  {
    id: '1',
    name: 'Administrador General',
    email: 'admin@controlgastos.com',
    password: '$2b$10$ugyVrrMofsdd5lXfNYFAvurhyiMeKiXJysk.SG0/4FNIxluLCtGgO', // Admin123!
    role: 'admin',
     googleId: null,
     avatarUrl: null,
  },
  {
    id: '2',
    name: 'Usuario Estándar',
    email: 'user@controlgastos.com',
    password: '$2b$10$aGpvtViywlA26AMIj9pXleVQduA5hxrKLNmkxy.pyaJUcFuH0V5Ki', // User123!
    role: 'user',
     googleId: null,
     avatarUrl: null,
  },
];
