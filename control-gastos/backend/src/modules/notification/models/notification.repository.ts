import { pool } from '@config/database';
import { Notification, NotificationCategory, NotificationType } from './notification.model';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  meta?: string | null;
}

export interface INotificationRepository {
  findAllByUser(userId: string): Promise<Notification[]>;
  create(input: CreateNotificationInput): Promise<Notification>;
  existsSince(userId: string, type: NotificationType, since: Date, meta?: string | null): Promise<boolean>;
  existsEver(userId: string, type: NotificationType): Promise<boolean>;
  markAsRead(id: string, userId: string): Promise<boolean>;
  markAllAsRead(userId: string): Promise<void>;
  delete(id: string, userId: string): Promise<boolean>;
}

const mapRow = (row: any): Notification => ({
  id: row.id,
  userId: row.user_id,
  type: row.type,
  category: row.category,
  title: row.title,
  message: row.message,
  meta: row.meta,
  isRead: row.is_read,
  createdAt: row.created_at,
});

export class PostgresNotificationRepository implements INotificationRepository {
  async findAllByUser(userId: string): Promise<Notification[]> {
    const { rows } = await pool.query(
      `SELECT id, user_id, type, category, title, message, meta, is_read, created_at
       FROM notifications WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );
    return rows.map(mapRow);
  }

  async create(input: CreateNotificationInput): Promise<Notification> {
    const { rows } = await pool.query(
      `INSERT INTO notifications (user_id, type, category, title, message, meta)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id, type, category, title, message, meta, is_read, created_at`,
      [input.userId, input.type, input.category, input.title, input.message, input.meta ?? null],
    );
    return mapRow(rows[0]);
  }

  // Usado para no duplicar avisos: ej. no crear "Límite de presupuesto
  // alcanzado" de la misma categoría más de una vez en el mismo mes.
  async existsSince(userId: string, type: NotificationType, since: Date, meta?: string | null): Promise<boolean> {
    const params: any[] = [userId, type, since];
    let query = `SELECT 1 FROM notifications WHERE user_id = $1 AND type = $2 AND created_at >= $3`;
    if (meta !== undefined) {
      query += ` AND meta = $4`;
      params.push(meta);
    }
    const { rows } = await pool.query(query + ' LIMIT 1', params);
    return rows.length > 0;
  }

  async existsEver(userId: string, type: NotificationType): Promise<boolean> {
    const { rows } = await pool.query(`SELECT 1 FROM notifications WHERE user_id = $1 AND type = $2 LIMIT 1`, [userId, type]);
    return rows.length > 0;
  }

  async markAsRead(id: string, userId: string): Promise<boolean> {
    const result = await pool.query(`UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`, [id, userId]);
    return (result.rowCount ?? 0) > 0;
  }

  async markAllAsRead(userId: string): Promise<void> {
    await pool.query(`UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`, [userId]);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await pool.query(`DELETE FROM notifications WHERE id = $1 AND user_id = $2`, [id, userId]);
    return (result.rowCount ?? 0) > 0;
  }
}

export const notificationRepository: INotificationRepository = new PostgresNotificationRepository();