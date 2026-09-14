import { pool } from '@config/database';
import { NotificationSettings } from './settings.model';

export interface ISettingsRepository {
  findByUser(userId: string): Promise<NotificationSettings | null>;
  upsert(userId: string, settings: Omit<NotificationSettings, 'userId' | 'updatedAt'>): Promise<NotificationSettings>;
}

const mapRow = (row: any): NotificationSettings => ({
  userId: row.user_id,
  notifyRecordatorio: row.notify_recordatorio,
  notifyTransaccion: row.notify_transaccion,
  notifyReporte: row.notify_reporte,
  notifySistema: row.notify_sistema,
  updatedAt: row.updated_at,
});

// Valores por defecto para un usuario que nunca ha guardado preferencias
// (todo activado, igual que el comportamiento actual de la app).
const DEFAULTS: Omit<NotificationSettings, 'userId' | 'updatedAt'> = {
  notifyRecordatorio: true,
  notifyTransaccion: true,
  notifyReporte: true,
  notifySistema: true,
};

export class PostgresSettingsRepository implements ISettingsRepository {
  async findByUser(userId: string): Promise<NotificationSettings | null> {
    const { rows } = await pool.query(
      `SELECT user_id, notify_recordatorio, notify_transaccion, notify_reporte, notify_sistema, updated_at
       FROM notification_settings WHERE user_id = $1`,
      [userId],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  // "Crear o actualizar" en una sola instrucción, como en las metas y
  // presupuestos.
  async upsert(userId: string, settings: Omit<NotificationSettings, 'userId' | 'updatedAt'>): Promise<NotificationSettings> {
    const { rows } = await pool.query(
      `INSERT INTO notification_settings (user_id, notify_recordatorio, notify_transaccion, notify_reporte, notify_sistema, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (user_id)
       DO UPDATE SET
         notify_recordatorio = EXCLUDED.notify_recordatorio,
         notify_transaccion = EXCLUDED.notify_transaccion,
         notify_reporte = EXCLUDED.notify_reporte,
         notify_sistema = EXCLUDED.notify_sistema,
         updated_at = now()
       RETURNING user_id, notify_recordatorio, notify_transaccion, notify_reporte, notify_sistema, updated_at`,
      [userId, settings.notifyRecordatorio, settings.notifyTransaccion, settings.notifyReporte, settings.notifySistema],
    );
    return mapRow(rows[0]);
  }

  // Usado por NotificationService antes de crear un aviso: si el usuario
  // nunca configuró nada, se asume todo activado (DEFAULTS).
  async getEffective(userId: string): Promise<Omit<NotificationSettings, 'userId' | 'updatedAt'>> {
    const existing = await this.findByUser(userId);
    if (!existing) return DEFAULTS;
    const { userId: _u, updatedAt: _up, ...rest } = existing;
    return rest;
  }
}

export const settingsRepository = new PostgresSettingsRepository();