import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { BudgetService } from '../../core/services/budget.service';
import { BUDGET_CATEGORIES, BudgetCategory, BudgetCategoryView, BudgetStatus, BudgetSummary } from '../../core/models/budget.model';

interface NavItem {
  icon: 'grid' | 'in' | 'out' | 'coffee' | 'list' | 'chart-pie' | 'chart-bar' | 'bell' | 'user' | 'gear';
  label: string;
  active?: boolean;
  route?: string;
}

type EstadoFilter = 'todos' | 'En rango' | 'Sobre el límite';

@Component({
  selector: 'app-presupuestos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './presupuestos.component.html',
  styleUrl: './presupuestos.component.css',
})
export class PresupuestosComponent implements OnInit {
  user: ReturnType<AuthService['getUser']>;

  navItems: NavItem[] = [
    { icon: 'grid', label: 'Vista General', route: '/dashboard' },
    { icon: 'in', label: 'Ingresos', route: '/ingresos' },
    { icon: 'out', label: 'Egresos', route: '/egresos' },
    { icon: 'coffee', label: 'Pequeños Consumos', route: '/pequenos-consumos' },
  ];
  navItemsSecondary: NavItem[] = [
    { icon: 'list', label: 'Transacciones', route: '/transacciones' },
    { icon: 'chart-pie', label: 'Presupuestos', active: true, route: '/presupuestos' },
  ];

    navItemsTertiary: NavItem[] = [
    { icon: 'chart-bar', label: 'Reportes', route: '/reportes' },
    { icon: 'bell', label: 'Notificaciones', route: '/notificaciones' },
  ];

    navItemsAccount: NavItem[] = [
    { icon: 'user', label: 'Cuenta', route: '/cuenta' },
    { icon: 'gear', label: 'Ajustes', route: '/ajustes' },
  ];

  readonly categories: BudgetCategory[] = BUDGET_CATEGORIES;
  readonly categoryColors: Record<BudgetCategory, string> = {
    Alimentación: '#12B5A0',
    Transporte: '#5B4FE8',
    Vivienda: '#3B82F6',
    Servicios: '#8B5CF6',
    Otros: '#C084FC',
    'Pequeños consumos': '#F59E0B',
  };

  isLoading = false;
  summary: BudgetSummary | null = null;
  monthLabel = '';

  // ---------- KPIs ----------
  totalPresupuestado = 'Q 0.00';
  totalGastado = 'Q 0.00';
  totalGastadoTrend = '';
  disponible = 'Q 0.00';
  disponiblePercent = 0;

  // ---------- Barras: avance por categoría ----------
  barRows: { category: BudgetCategory; spent: number; budgeted: number }[] = [];
  private readonly barMaxHeight = 190;

  // ---------- Dona: distribución del gasto ----------
  donutSlices: { category: BudgetCategory; amount: string; percent: number; color: string }[] = [];

  // ---------- Tabla "Mis presupuestos" ----------
  get filteredCategories(): BudgetCategoryView[] {
    if (!this.summary) return [];
    return this.summary.categories.filter((c) => {
      if (this.filterCategory !== 'todas' && c.category !== this.filterCategory) return false;
      if (this.filterEstado !== 'todos' && c.status !== this.filterEstado) return false;
      return true;
    });
  }

  // ---------- Filtros ----------
  filterCategory: BudgetCategory | 'todas' = 'todas';
  filterEstado: EstadoFilter = 'todos';

  // ---------- Modal: editar presupuesto de una categoría ----------
  showModal = false;
  editingCategory: BudgetCategory | null = null;
  editingAmount: number | null = null;
  isSaving = false;

  constructor(
    private authService: AuthService,
    private budgetService: BudgetService,
    private router: Router,
  ) {
    this.user = this.authService.getUser();
  }

  ngOnInit(): void {
    this.loadBudgets();
  }

  loadBudgets(): void {
    this.isLoading = true;
    this.budgetService.getSummary().subscribe({
      next: (res) => {
        this.applySummary(res.data);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error cargando presupuestos', err);
        this.isLoading = false;
      },
    });
  }

  private applySummary(summary: BudgetSummary): void {
    this.summary = summary;
    this.monthLabel = summary.monthLabel;

    this.totalPresupuestado = this.formatQ(summary.totalBudgeted);
    this.totalGastado = this.formatQ(summary.totalSpent);
    this.disponible = this.formatQ(summary.totalAvailable);
    this.disponiblePercent = summary.totalBudgeted > 0 ? Math.round((summary.totalSpent / summary.totalBudgeted) * 100) : 0;

    if (summary.totalSpentLastMonth > 0) {
      const change = ((summary.totalSpent - summary.totalSpentLastMonth) / summary.totalSpentLastMonth) * 100;
      const arrow = change >= 0 ? '▲' : '▼';
      this.totalGastadoTrend = `${arrow} ${Math.abs(change).toFixed(1)}% vs mes anterior`;
    } else {
      this.totalGastadoTrend = summary.totalSpent > 0 ? '▲ Nuevo este mes' : '';
    }

    this.barRows = summary.categories.map((c) => ({ category: c.category, spent: c.spent, budgeted: c.monthlyAmount }));

    const totalSpent = summary.totalSpent;
    this.donutSlices = summary.categories
      .filter((c) => c.spent > 0)
      .map((c) => ({
        category: c.category,
        amount: this.formatQ(c.spent),
        percent: totalSpent > 0 ? Math.round((c.spent / totalSpent) * 100) : 0,
        color: this.categoryColors[c.category],
      }));
  }

  get barMax(): number {
    const values = this.barRows.flatMap((r) => [r.spent, r.budgeted]);
    return Math.max(...values, 100);
  }

  barHeight(value: number): number {
    return this.barMax > 0 ? Math.round((value / this.barMax) * this.barMaxHeight) : 0;
  }

  get donutGradient(): string {
    const total = this.donutSlices.reduce((sum, s) => sum + s.percent, 0);
    if (total === 0) return '#eef0f5';
    let acc = 0;
    const stops = this.donutSlices.map((slice) => {
      const start = acc;
      acc += slice.percent;
      return `${slice.color} ${start}% ${acc}%`;
    });
    return `conic-gradient(${stops.join(', ')})`;
  }

  statusClass(status: BudgetStatus): string {
    if (status === 'Sobre el límite') return 'badge--danger';
    if (status === 'Cerca del límite') return 'badge--warn';
    return 'badge--ok';
  }

  setEstadoFilter(estado: EstadoFilter): void {
    this.filterEstado = estado;
  }

  resetFilters(): void {
    this.filterCategory = 'todas';
    this.filterEstado = 'todos';
  }

  openEditModal(view: BudgetCategoryView): void {
    this.editingCategory = view.category;
    this.editingAmount = view.monthlyAmount;
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingCategory = null;
    this.editingAmount = null;
  }

  submitBudget(): void {
    if (!this.editingCategory || this.editingAmount === null || this.editingAmount < 0) return;

    this.isSaving = true;
    this.budgetService.setBudget(this.editingCategory, Number(this.editingAmount)).subscribe({
      next: (res) => {
        this.applySummary(res.data);
        this.isSaving = false;
        this.closeModal();
      },
      error: (err) => {
        console.error('Error guardando presupuesto', err);
        this.isSaving = false;
      },
    });
  }

  private formatQ(value: number): string {
    return 'Q ' + value.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}