import bcrypt from 'bcrypt';
import { userRepository } from '../models/user.repository';
import { SafeUser, User } from '../models/user.model';
import { TokenService } from './token.service';
import { GoogleAuthService } from './google-auth.service';

interface LoginResult {
  token: string;
  user: SafeUser;
}

export class AuthService {
  static async login(email: string, password: string): Promise<LoginResult> {
    const user = await userRepository.findByEmail(email);

    if (!user || !user.password) {
      throw new Error('CREDENTIALS_INVALID');
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      throw new Error('CREDENTIALS_INVALID');
    }

    return this.buildLoginResult(user.id, user.email, user.role, user);
  }

  static async loginWithGoogle(idToken: string): Promise<LoginResult> {
  const profile = await GoogleAuthService.verifyIdToken(idToken);

  let user = await userRepository.findByGoogleId(profile.googleId);

  if (user) {
    await userRepository.updateGoogleProfile(user.id, {
      name: profile.name,
      avatarUrl: profile.avatarUrl,
    });
    user = { ...user, name: profile.name, avatarUrl: profile.avatarUrl };
  } else {
    const existingByEmail = await userRepository.findByEmail(profile.email);

    if (existingByEmail) {
      await userRepository.linkGoogleId(existingByEmail.id, profile.googleId);
      await userRepository.updateGoogleProfile(existingByEmail.id, {
        name: profile.name,
        avatarUrl: profile.avatarUrl,
      });
      user = {
        ...existingByEmail,
        googleId: profile.googleId,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
      };
    } else {
      user = await userRepository.createFromGoogle({
        name: profile.name,
        email: profile.email,
        googleId: profile.googleId,
        avatarUrl: profile.avatarUrl,
      });
    }
  }

  return this.buildLoginResult(user.id, user.email, user.role, user);
}

  private static buildLoginResult(
    id: string,
    email: string,
    role: SafeUser['role'],
    user: User,
  ): LoginResult {
    const token = TokenService.generateToken({ sub: id, email, role });
    const { password: _password, ...safeUser } = user;
    return { token, user: safeUser };
  }
}