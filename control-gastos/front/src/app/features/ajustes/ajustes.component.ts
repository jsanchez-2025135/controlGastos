import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SettingsService } from '../../core/services/settings.service';
import { NotificationSettings } from '../../core/models/settings.model';

interface NavItem {
  icon: 'grid' | 'in' | 'out' | 'coffee' | 'list' | 'chart-pie' | 'chart-bar' | 'bell' | 'user' | 'gear';
  label: string;
  active?: boolean;
  route?: string;
}

interface ToggleRow {
  key: keyof NotificationSettings;
  label: string;
  description: string;
}

@Component({
  selector: 'app-ajustes',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './ajustes.component.html',
  styleUrl: './ajustes.component.css',
})
export class AjustesComponent implements OnInit {
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
    { icon: 'bell', label: 'Notificaciones', route: '/notificaciones' },
  ];
  navItemsAccount: NavItem[] = [
    { icon: 'user', label: 'Cuenta', route: '/cuenta' },
    { icon: 'gear', label: 'Ajustes', active: true, route: '/ajustes' },
  ];

  readonly toggleRows: ToggleRow[] = [
    { key: 'notifyRecordatorio', label: 'Recordatorios', description: 'Avisos de presupuestos cerca del límite o sobre el límite.' },
    { key: 'notifyTransaccion', label: 'Transacciones', description: 'Ingresos recibidos, egresos registrados y gastos inusuales.' },
    { key: 'notifyReporte', label: 'Reportes', description: 'Aviso cuando el reporte del mes anterior está disponible.' },
    { key: 'notifySistema', label: 'Sistema', description: 'Bienvenida y logros como tu tasa de ahorro mensual.' },
  ];

  isLoading = false;
  isSaving = false;
  saveSuccess = false;

  settings: NotificationSettings = {
    notifyRecordatorio: true,
    notifyTransaccion: true,
    notifyReporte: true,
    notifySistema: true,
  };

  constructor(
    private authService: AuthService,
    private settingsService: SettingsService,
    private router: Router,
  ) {
    this.user = this.authService.getUser();
  }

  ngOnInit(): void {
    this.loadSettings();
  }

  loadSettings(): void {
    this.isLoading = true;
    this.settingsService.getSettings().subscribe({
      next: (res) => {
        this.settings = res.data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error cargando preferencias', err);
        this.isLoading = false;
      },
    });
  }

  toggle(key: keyof NotificationSettings): void {
    this.settings = { ...this.settings, [key]: !this.settings[key] };
    this.saveSuccess = false;
  }

  save(): void {
    this.isSaving = true;
    this.saveSuccess = false;
    this.settingsService.updateSettings(this.settings).subscribe({
      next: (res) => {
        this.settings = res.data;
        this.isSaving = false;
        this.saveSuccess = true;
      },
      error: (err) => {
        console.error('Error guardando preferencias', err);
        this.isSaving = false;
      },
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}