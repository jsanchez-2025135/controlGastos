export type NotificationCategory = 'recordatorio' | 'transaccion' | 'reporte' | 'sistema';

export type NotificationType =
  | 'ingreso'
  | 'egreso'
  | 'gasto_inusual'
  | 'presupuesto_recordatorio'
  | 'presupuesto_limite'
  | 'ahorro'
  | 'reporte_disponible'
  | 'bienvenida';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  meta: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationSummary {
  items: Notification[];
  total: number;
  totalRead: number;
  totalPending: number;
  lastNotificationAt: string | null;
  byCategory: Record<NotificationCategory, number>;
}