import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { Notification, NotificationCategory, NotificationSummary } from '../../core/models/notification.model';

interface NavItem {
  icon: 'grid' | 'in' | 'out' | 'coffee' | 'list' | 'chart-pie' | 'chart-bar' | 'bell' | 'user' | 'gear';
  label: string;
  active?: boolean;
  route?: string;
}

type EstadoFilter = 'todos' | 'pendientes' | 'leidas';
type SortOrder = 'recientes' | 'antiguas';

interface NotificationView extends Notification {
  dateLabel: string;
  icon: 'wallet' | 'up' | 'calendar' | 'chart' | 'warning' | 'target' | 'bell';
  tone: 'pink' | 'teal' | 'purple' | 'blue';
  menuOpen: boolean;
}

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  recordatorio: 'Recordatorios',
  transaccion: 'Transacciones',
  reporte: 'Reportes',
  sistema: 'Sistema',
};

const CATEGORY_ICONS: Record<NotificationCategory, 'bell' | 'up' | 'chart' | 'target'> = {
  recordatorio: 'bell',
  transaccion: 'up',
  reporte: 'chart',
  sistema: 'target',
};

@Component({
  selector: 'app-notificaciones',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './notificaciones.component.html',
  styleUrl: './notificaciones.component.css',
})
export class NotificacionesComponent implements OnInit {
  user: ReturnType<AuthService['getUser']>;

  navItems: NavItem[] = [
    { icon: 'grid', label: 'Vista General', route: '/dashboard' },
    { icon: 'in', label: 'Ingresos', route: '/ingresos' },
    { icon: 'out', label: 'Egresos', route: '/egresos' },
    { icon: 'coffee', label: 'Pequeños Consumos', route: '/pequenos-consumos' },
  ];
  navItemsSecondary: NavItem[] = [
    { icon: 'list', label: 'Transacciones', route: '/transacciones' },
    { icon: 'chart-pie', label: 'Presupuestos', route: '/presupuestos' },
  ];
  navItemsTertiary: NavItem[] = [
    { icon: 'chart-bar', label: 'Reportes', route: '/reportes' },
    { icon: 'bell', label: 'Notificaciones', active: true, route: '/notificaciones' },
  ];
      navItemsAccount: NavItem[] = [
    { icon: 'user', label: 'Cuenta', route: '/cuenta' },
    { icon: 'gear', label: 'Ajustes', route: '/ajustes' },
  ];

  readonly categoryLabels = CATEGORY_LABELS;
  readonly categories: NotificationCategory[] = ['recordatorio', 'transaccion', 'reporte', 'sistema'];

  isLoading = false;
  private summary: NotificationSummary | null = null;
  private allNotifications: NotificationView[] = [];

  // ---------- KPIs ----------
  totalNotificaciones = 0;
  totalLeidas = 0;
  totalPendientes = 0;
  totalLeidasTrend = '';
  totalPendientesTrend = '';
  totalNotificacionesTrend = '';
  ultimaNotificacionLabel = '—';
  ultimaNotificacionTipo = '';

  // ---------- Resumen por categoría ----------
  resumenRows: { category: NotificationCategory; count: number; percent: number }[] = [];

  // ---------- Filtros ----------
  filterEstado: EstadoFilter = 'todos';
  filterCategory: NotificationCategory | 'todas' = 'todas';
  filterDateFrom = '';
  filterDateTo = '';
  sortOrder: SortOrder = 'recientes';

  constructor(
    private authService: AuthService,
    private notificationService: NotificationService,
    private router: Router,
  ) {
    this.user = this.authService.getUser();
  }

  ngOnInit(): void {
    this.loadNotifications();
  }

  loadNotifications(): void {
    this.isLoading = true;
    this.notificationService.getSummary().subscribe({
      next: (res) => {
        this.applySummary(res.data);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error cargando notificaciones', err);
        this.isLoading = false;
      },
    });
  }

  private applySummary(summary: NotificationSummary): void {
    this.summary = summary;
    this.allNotifications = summary.items.map((n) => this.toView(n));

    this.totalNotificaciones = summary.total;
    this.totalLeidas = summary.totalRead;
    this.totalPendientes = summary.totalPending;

    if (summary.items.length > 0) {
      const last = summary.items[0];
      this.ultimaNotificacionLabel = this.formatDateTime(last.createdAt);
      this.ultimaNotificacionTipo = last.title;
    } else {
      this.ultimaNotificacionLabel = '—';
      this.ultimaNotificacionTipo = '';
    }

    const total = summary.total || 1;
    this.resumenRows = this.categories.map((cat) => ({
      category: cat,
      count: summary.byCategory[cat],
      percent: Math.round((summary.byCategory[cat] / total) * 100),
    }));
  }

  private toView(n: Notification): NotificationView {
    const { icon, tone } = this.iconAndToneFor(n.type);
    return { ...n, dateLabel: this.formatDateTime(n.createdAt), icon, tone, menuOpen: false };
  }

  private iconAndToneFor(type: Notification['type']): { icon: NotificationView['icon']; tone: NotificationView['tone'] } {
    switch (type) {
      case 'presupuesto_limite':
        return { icon: 'wallet', tone: 'pink' };
      case 'presupuesto_recordatorio':
        return { icon: 'calendar', tone: 'purple' };
      case 'ingreso':
        return { icon: 'up', tone: 'teal' };
      case 'egreso':
        return { icon: 'wallet', tone: 'pink' };
      case 'gasto_inusual':
        return { icon: 'warning', tone: 'purple' };
      case 'reporte_disponible':
        return { icon: 'chart', tone: 'blue' };
      case 'ahorro':
        return { icon: 'target', tone: 'blue' };
      case 'bienvenida':
      default:
        return { icon: 'bell', tone: 'purple' };
    }
  }

  get filteredNotifications(): NotificationView[] {
    let list = this.allNotifications.filter((n) => {
      if (this.filterEstado === 'pendientes' && n.isRead) return false;
      if (this.filterEstado === 'leidas' && !n.isRead) return false;
      if (this.filterCategory !== 'todas' && n.category !== this.filterCategory) return false;
      if (this.filterDateFrom && n.createdAt.slice(0, 10) < this.filterDateFrom) return false;
      if (this.filterDateTo && n.createdAt.slice(0, 10) > this.filterDateTo) return false;
      return true;
    });

    list = [...list].sort((a, b) => (this.sortOrder === 'recientes' ? (a.createdAt < b.createdAt ? 1 : -1) : a.createdAt < b.createdAt ? -1 : 1));
    return list;
  }

  setEstadoFilter(estado: EstadoFilter): void {
    this.filterEstado = estado;
  }

  resetFilters(): void {
    this.filterEstado = 'todos';
    this.filterCategory = 'todas';
    this.filterDateFrom = '';
    this.filterDateTo = '';
  }

  toggleMenu(n: NotificationView, event: Event): void {
    event.stopPropagation();
    const wasOpen = n.menuOpen;
    this.allNotifications.forEach((item) => (item.menuOpen = false));
    n.menuOpen = !wasOpen;
  }

  closeMenus(): void {
    this.allNotifications.forEach((item) => (item.menuOpen = false));
  }

  markAsRead(n: NotificationView): void {
    n.menuOpen = false;
    if (n.isRead) return;
    this.notificationService.markAsRead(n.id).subscribe({
      next: () => this.loadNotifications(),
      error: (err) => console.error('Error marcando como leída', err),
    });
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead().subscribe({
      next: () => this.loadNotifications(),
      error: (err) => console.error('Error marcando todas como leídas', err),
    });
  }

  deleteNotification(n: NotificationView): void {
    n.menuOpen = false;
    const confirmado = confirm(`¿Eliminar la notificación "${n.title}"?`);
    if (!confirmado) return;
    this.notificationService.delete(n.id).subscribe({
      next: () => this.loadNotifications(),
      error: (err) => console.error('Error eliminando notificación', err),
    });
  }

  private formatDateTime(iso: string): string {
    const d = new Date(iso);
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const hoy = new Date();
    const esHoy = d.toDateString() === hoy.toDateString();
    const ayer = new Date(hoy);
    ayer.setDate(hoy.getDate() - 1);
    const esAyer = d.toDateString() === ayer.toDateString();

    const hora = d.toLocaleTimeString('es-GT', { hour: 'numeric', minute: '2-digit', hour12: true });
    if (esHoy) return `Hoy, ${hora}`;
    if (esAyer) return `Ayer, ${hora}`;
    return `${d.getDate()} ${meses[d.getMonth()]}, ${hora}`;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}