import { NotificationCategory } from '@modules/notification/models/notification.model';

export interface NotificationSettings {
  userId: string;
  notifyRecordatorio: boolean;
  notifyTransaccion: boolean;
  notifyReporte: boolean;
  notifySistema: boolean;
  updatedAt: string;
}

// Mapea cada categoría de notificación a su columna en la tabla, para no
// repetir el switch en varios lugares.
export const CATEGORY_TO_FIELD: Record<NotificationCategory, keyof NotificationSettings> = {
  recordatorio: 'notifyRecordatorio',
  transaccion: 'notifyTransaccion',
  reporte: 'notifyReporte',
  sistema: 'notifySistema',
};