import { notificationRepository } from '../models/notification.repository';
import { Notification } from '../models/notification.model';
import { incomeRepository } from '@modules/income/models/income.repository';
import { expenseRepository } from '@modules/expense/models/expense.repository';
import { ExpenseCategory } from '@modules/expense/models/expense.model';
import { settingsRepository } from '@modules/settings/models/settings.repository';
import { CATEGORY_TO_FIELD } from '@modules/settings/models/settings.model';

const startOfMonth = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

const monthNameOf = (date: Date): string => {
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${meses[date.getMonth()]} ${date.getFullYear()}`;
};

const formatQ = (value: number): string => 'Q' + value.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface NotificationSummary {
  items: Notification[];
  total: number;
  totalRead: number;
  totalPending: number;
  lastNotificationAt: string | null;
  byCategory: Record<'recordatorio' | 'transaccion' | 'reporte' | 'sistema', number>;
}

/**
 * Capa de servicio: además del CRUD normal, expone métodos "notifyX" que
 * llaman los demás módulos (Ingresos, Egresos, Presupuestos) para avisar
 * cuando pasa algo. Aquí también viven las reglas para no duplicar avisos.
 */
export class NotificationService {
  // Se llama al abrir la pantalla de Notificaciones: genera "de oficio" los
  // avisos que dependen del calendario (bienvenida, reporte del mes nuevo)
  // antes de devolver la lista.
  private static async isCategoryEnabled(userId: string, category: 'recordatorio' | 'transaccion' | 'reporte' | 'sistema'): Promise<boolean> {
    const settings = await settingsRepository.getEffective(userId);
    return settings[CATEGORY_TO_FIELD[category]];
  }

  static async list(userId: string): Promise<NotificationSummary> {
    await this.ensureWelcome(userId);
    await this.ensureMonthlyReportNotice(userId);

    const items = await notificationRepository.findAllByUser(userId);
    const totalRead = items.filter((n) => n.isRead).length;

    const byCategory = { recordatorio: 0, transaccion: 0, reporte: 0, sistema: 0 } as Record<'recordatorio' | 'transaccion' | 'reporte' | 'sistema', number>;
    items.forEach((n) => { byCategory[n.category]++; });

    return {
      items,
      total: items.length,
      totalRead,
      totalPending: items.length - totalRead,
      lastNotificationAt: items[0]?.createdAt ?? null,
      byCategory,
    };
  }

  static async markAsRead(id: string, userId: string): Promise<void> {
    const ok = await notificationRepository.markAsRead(id, userId);
    if (!ok) throw new Error('NOTIFICATION_NOT_FOUND');
  }

  static async markAllAsRead(userId: string): Promise<void> {
    await notificationRepository.markAllAsRead(userId);
  }

  static async remove(id: string, userId: string): Promise<void> {
    const ok = await notificationRepository.delete(id, userId);
    if (!ok) throw new Error('NOTIFICATION_NOT_FOUND');
  }

  // ---------- Disparadores (llamados desde otros módulos) ----------

  static async notifyIncome(userId: string, amount: number, category: string): Promise<void> {
    if (!(await this.isCategoryEnabled(userId, 'transaccion'))) return;
    await notificationRepository.create({
      userId,
      type: 'ingreso',
      category: 'transaccion',
      title: 'Ingreso recibido',
      message: `Se registró un nuevo ingreso de ${formatQ(amount)} (${category}).`,
    });
  }

  static async notifyExpense(userId: string, amount: number, category: string): Promise<void> {
    if (!(await this.isCategoryEnabled(userId, 'transaccion'))) return;
    await notificationRepository.create({
      userId,
      type: 'egreso',
      category: 'transaccion',
      title: 'Egreso registrado',
      message: `Se registró un egreso de ${formatQ(amount)} (${category}).`,
    });
  }

  // Compara el monto contra el promedio de los egresos previos de esa
  // categoría (sin contar el actual). Necesita al menos 3 egresos previos
  // para que el promedio tenga sentido, y dispara si el monto duplica ese
  // promedio.
  static async notifyIfUnusualExpense(userId: string, amount: number, category: ExpenseCategory): Promise<void> {
    if (!(await this.isCategoryEnabled(userId, 'transaccion'))) return;
    const previous = (await expenseRepository.findAllByUser(userId)).filter((e) => e.category === category && e.amount !== amount);
    if (previous.length < 3) return;

    const average = previous.reduce((sum, e) => sum + e.amount, 0) / previous.length;
    if (amount > average * 2) {
      await notificationRepository.create({
        userId,
        type: 'gasto_inusual',
        category: 'transaccion',
        title: 'Gasto inusual detectado',
        message: `Se ha identificado un gasto de ${formatQ(amount)} en la categoría ${category}, muy por encima de tu promedio habitual.`,
      });
    }
  }

  // Se llama después de crear/editar un egreso, con el % ya calculado
  // (gastado / presupuesto de esa categoría este mes). No duplica el mismo
  // aviso para la misma categoría dentro del mismo mes.
  static async notifyBudgetThreshold(userId: string, category: ExpenseCategory, percent: number): Promise<void> {
    if (!(await this.isCategoryEnabled(userId, 'recordatorio'))) return;

    if (percent >= 100) {
      const already = await notificationRepository.existsSince(userId, 'presupuesto_limite', startOfMonth(), category);
      if (!already) {
        await notificationRepository.create({
          userId,
          type: 'presupuesto_limite',
          category: 'recordatorio',
          title: 'Límite de presupuesto alcanzado',
          message: `Has alcanzado el 100% de tu presupuesto en la categoría ${category}.`,
          meta: category,
        });
      }
    } else if (percent >= 80) {
      const already = await notificationRepository.existsSince(userId, 'presupuesto_recordatorio', startOfMonth(), category);
      if (!already) {
        await notificationRepository.create({
          userId,
          type: 'presupuesto_recordatorio',
          category: 'recordatorio',
          title: 'Recordatorio de presupuesto',
          message: `Te recordamos que tu presupuesto de ${category} está por agotarse (${percent}%).`,
          meta: category,
        });
      }
    }
  }

  // "Objetivo de ahorro" adaptado: % de tus ingresos de este mes que no has
  // gastado. Avisa una sola vez por umbral (25/50/75/100) por mes.
  static async checkSavingsRate(userId: string): Promise<void> {
    if (!(await this.isCategoryEnabled(userId, 'sistema'))) return;

    const now = new Date();
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const [incomes, expenses] = await Promise.all([incomeRepository.findAllByUser(userId), expenseRepository.findAllByUser(userId)]);
    const totalIngresos = incomes.filter((i) => i.date.slice(0, 7) === thisMonthKey).reduce((sum, i) => sum + i.amount, 0);
    const totalEgresos = expenses.filter((e) => e.date.slice(0, 7) === thisMonthKey).reduce((sum, e) => sum + e.amount, 0);
    if (totalIngresos <= 0) return;

    const rate = Math.round(((totalIngresos - totalEgresos) / totalIngresos) * 100);
    const thresholds = [100, 75, 50, 25];
    const reached = thresholds.find((t) => rate >= t);
    if (!reached) return;

    const meta = String(reached);
    const already = await notificationRepository.existsSince(userId, 'ahorro', startOfMonth(), meta);
    if (already) return;

    await notificationRepository.create({
      userId,
      type: 'ahorro',
      category: 'sistema',
      title: 'Objetivo de ahorro',
      message: `¡Felicidades! Has ahorrado el ${reached}% de tus ingresos este mes.`,
      meta,
    });
  }

  // ---------- Avisos "de oficio" (dependen del calendario) ----------

  private static async ensureWelcome(userId: string): Promise<void> {
    const already = await notificationRepository.existsEver(userId, 'bienvenida');
    if (already) return;
    await notificationRepository.create({
      userId,
      type: 'bienvenida',
      category: 'sistema',
      title: 'Bienvenido',
      message: 'Gracias por confiar en nuestra aplicación. ¡Esperamos que sea de gran ayuda!',
    });
  }

  private static async ensureMonthlyReportNotice(userId: string): Promise<void> {
    if (!(await this.isCategoryEnabled(userId, 'reporte'))) return;

    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const meta = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;

    const already = await notificationRepository.existsSince(userId, 'reporte_disponible', startOfMonth(), meta);
    if (already) return;

    await notificationRepository.create({
      userId,
      type: 'reporte_disponible',
      category: 'reporte',
      title: 'Nuevo reporte disponible',
      message: `Ya está disponible tu reporte mensual de ${monthNameOf(lastMonth)}.`,
      meta,
    });
  }
}