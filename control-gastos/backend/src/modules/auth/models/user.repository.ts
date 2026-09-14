import { pool } from '../../../config/database';
import { User } from './user.model';

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  findByGoogleId(googleId: string): Promise<User | null>;
  createFromGoogle(data: {
    name: string;
    email: string;
    googleId: string;
    avatarUrl: string | null;
  }): Promise<User>;
  linkGoogleId(userId: string, googleId: string): Promise<void>;
  updateGoogleProfile(userId: string, data: { name: string; avatarUrl: string | null }): Promise<void>;
}

const SELECT_FIELDS =
  'id, name, email, password, role, google_id AS "googleId", avatar_url AS "avatarUrl"';

export class PostgresUserRepository implements IUserRepository {
  async findByEmail(email: string): Promise<User | null> {
    const { rows } = await pool.query<User>(
      `SELECT ${SELECT_FIELDS} FROM users WHERE email = $1 LIMIT 1`,
      [email],
    );
    return rows[0] ?? null;
  }

  async findById(id: string): Promise<User | null> {
    const { rows } = await pool.query<User>(
      `SELECT ${SELECT_FIELDS} FROM users WHERE id = $1 LIMIT 1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    const { rows } = await pool.query<User>(
      `SELECT ${SELECT_FIELDS} FROM users WHERE google_id = $1 LIMIT 1`,
      [googleId],
    );
    return rows[0] ?? null;
  }

  async createFromGoogle(data: {
    name: string;
    email: string;
    googleId: string;
    avatarUrl: string | null;
  }): Promise<User> {
    const { rows } = await pool.query<User>(
      `INSERT INTO users (name, email, google_id, avatar_url, role)
       VALUES ($1, $2, $3, $4, 'user')
       RETURNING ${SELECT_FIELDS}`,
      [data.name, data.email, data.googleId, data.avatarUrl],
    );
    return rows[0];
  }

  async linkGoogleId(userId: string, googleId: string): Promise<void> {
    await pool.query('UPDATE users SET google_id = $1 WHERE id = $2', [googleId, userId]);
  }

  async updateGoogleProfile(userId: string, data: { name: string; avatarUrl: string | null }): Promise<void> {
    await pool.query('UPDATE users SET name = $1, avatar_url = $2 WHERE id = $3', [
      data.name,
      data.avatarUrl,
      userId,
    ]);
  }
}

export const userRepository: IUserRepository = new PostgresUserRepository();