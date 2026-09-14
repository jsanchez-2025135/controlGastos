import bcrypt from 'bcrypt';
import { userRepository } from '@modules/auth/models/user.repository';
import { SafeUser } from '@modules/auth/models/user.model';
import { incomeRepository } from '@modules/income/models/income.repository';
import { expenseRepository } from '@modules/expense/models/expense.repository';

export interface AccountProfile {
  user: SafeUser;
  hasPassword: boolean;
  accessMethod: 'Contraseña' | 'Google';
  totalTransacciones: number;
}

/**
 * Capa de servicio del módulo "Cuenta": perfil, cambio de nombre y cambio
 * de contraseña. Reutiliza el userRepository que ya vive en el módulo auth
 * (no duplicamos acceso a la tabla "users" en dos lugares).
 */
export class AccountService {
  static async getProfile(userId: string): Promise<AccountProfile> {
    const user = await userRepository.findById(userId);
    if (!user) throw new Error('USER_NOT_FOUND');

    const [incomes, expenses] = await Promise.all([
      incomeRepository.findAllByUser(userId),
      expenseRepository.findAllByUser(userId),
    ]);

    const { password: _password, ...safeUser } = user;

    return {
      user: safeUser,
      hasPassword: !!user.password,
      accessMethod: user.googleId ? 'Google' : 'Contraseña',
      totalTransacciones: incomes.length + expenses.length,
    };
  }

  static async updateName(userId: string, name: string): Promise<void> {
    if (!name || name.trim().length < 3) throw new Error('NAME_INVALID');
    await userRepository.updateName(userId, name.trim());
  }

  static async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await userRepository.findById(userId);
    if (!user) throw new Error('USER_NOT_FOUND');

    if (!user.password) throw new Error('GOOGLE_ACCOUNT_NO_PASSWORD');
    if (!newPassword || newPassword.length < 8) throw new Error('PASSWORD_TOO_SHORT');

    const matches = await bcrypt.compare(currentPassword ?? '', user.password);
    if (!matches) throw new Error('CURRENT_PASSWORD_INVALID');

    const hash = await bcrypt.hash(newPassword, 10);
    await userRepository.updatePassword(userId, hash);
  }
}