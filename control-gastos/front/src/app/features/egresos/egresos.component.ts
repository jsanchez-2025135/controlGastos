import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ExpenseService } from '../../core/services/expense.service';
import { ExpenseGoalService } from '../../core/services/expense-goal.service';
import { Expense, ExpenseCategory } from '../../core/models/expense.model';

interface NavItem {
  icon: 'grid' | 'in' | 'out' | 'coffee' | 'list' | 'chart-pie' | 'chart-bar' | 'bell' | 'user' | 'gear';
  label: string;
  active?: boolean;
  route?: string;
}

interface SeriesPoint {
  day: number;    // día del mes (1-31)
  label: string;  // "1 May"
  value: number;  // total registrado ESE día (no acumulado)
}

interface ExpenseSlice {
  label: ExpenseCategory;
  amount: string;
  percent: number;
  color: string;
}

interface TopPaymentMethodView {
  label: string;
  amount: string;
  percent: number;
  count: number;
}

interface HighestExpenseView {
  description: string;
  category: ExpenseCategory;
  amount: string;
  date: string;
}

interface RecentExpenseView {
  id: string;
  description: string;
  category: ExpenseCategory;
  date: string;
  amount: number;
  method: string;
}

// Fecha de HOY en horario LOCAL del usuario, en formato YYYY-MM-DD.
// OJO: no usar new Date().toISOString() aquí, porque esa convierte a UTC
// y en Guatemala (UTC-6) puede adelantar la fecha un día durante la tarde/noche.
function localTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Validador de formulario: no permite fechas posteriores al día actual.
// Sí permite hoy o cualquier fecha pasada.
function noFutureDateValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null;
    return control.value > localTodayIso() ? { futureDate: true } : null;
  };
}

@Component({
  selector: 'app-egresos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './egresos.component.html',
  styleUrl: './egresos.component.css',
})
export class EgresosComponent implements OnInit {
  user: ReturnType<AuthService['getUser']>;

  navItems: NavItem[] = [
    { icon: 'grid', label: 'Vista General', route: '/dashboard' },
    { icon: 'in', label: 'Ingresos', route: '/ingresos' },
    { icon: 'out', label: 'Egresos', active: true, route: '/egresos' },
    { icon: 'coffee', label: 'Pequeños Consumos' },
  ];
  navItemsSecondary: NavItem[] = [
    { icon: 'list', label: 'Transacciones' },
    { icon: 'chart-pie', label: 'Presupuestos' },
  ];
  navItemsTertiary: NavItem[] = [
    { icon: 'chart-bar', label: 'Reportes' },
    { icon: 'bell', label: 'Notificaciones' },
  ];
  navItemsAccount: NavItem[] = [
    { icon: 'user', label: 'Cuenta' },
    { icon: 'gear', label: 'Ajustes' },
  ];

  readonly categories: ExpenseCategory[] = ['Alimentación', 'Transporte', 'Vivienda', 'Servicios', 'Otros'];
  readonly categoryColors: Record<ExpenseCategory, string> = {
    Alimentación: '#12B5A0',
    Transporte: '#5B4FE8',
    Vivienda: '#3B82F6',
    Servicios: '#8B5CF6',
    Otros: '#C084FC',
  };
  readonly paymentMethods = ['Efectivo', 'Transferencia', 'Tarjeta de crédito', 'Depósito'];

  // Límite mensual de referencia para la barra "Meta de egresos".
  // Ya NO es fijo: se carga desde /api/expense-goals al iniciar (loadExpenses)
  // y se actualiza cuando el usuario la edita en el modal (submitGoal).
  metaEgresos = 5000;

  isLoading = false;
  recentExpenses: RecentExpenseView[] = [];
  showAllExpenses = false;

  // ---------- KPIs (todos calculados sobre EL MES ACTUAL) ----------
  totalEgresos = 'Q 0.00';
  totalTrend = '';
  egresosRegistrados = 0;
  promedioDiario = 'Q 0.00';
  metaPercent = 0;
  metaLabel = 'Q 0.00 de Q 0.00';

  distribution: ExpenseSlice[] = this.categories.map((cat) => ({
    label: cat,
    amount: 'Q 0.00',
    percent: 0,
    color: this.categoryColors[cat],
  }));

  // ---------- NUEVO: "Resumen rápido" (reemplaza la lista de categorías
  // duplicada que ya se ve en la dona de arriba) ----------
  topPaymentMethod: TopPaymentMethodView | null = null;
  highestExpense: HighestExpenseView | null = null;

  series: SeriesPoint[] = this.buildSeries([]);

  // Todos los egresos tal como vienen del backend (sin filtrar), para poder
  // recalcular la gráfica cuando el usuario cambia de mes sin pedirlos de nuevo.
  private allExpenses: Expense[] = [];

  // Mes que se está mostrando en "Evolución de egresos", formato "YYYY-MM".
  selectedMonthKey: string = this.monthKey(new Date());

  private readonly chartWidth = 650; // ancho útil dentro del <g translate(50,0)>
  private readonly chartHeight = 200;

  availableMonths: { value: string; label: string }[] = this.buildAvailableMonths([]);

  private buildAvailableMonths(expenses: Expense[]): { value: string; label: string }[] {
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const keys = new Set<string>([this.monthKey(new Date())]);
    expenses.forEach((e) => keys.add(e.date.slice(0, 7)));

    return [...keys]
      .sort((a, b) => b.localeCompare(a))
      .map((key) => {
        const [y, m] = key.split('-').map(Number);
        return { value: key, label: `${meses[m - 1]} ${y}` };
      });
  }

  trackByMonthValue(_index: number, item: { value: string }): string {
    return item.value;
  }

  get chartPoints() {
    const maxValue = Math.max(...this.series.map((p) => p.value), 1);
    const niceMax = this.roundUpNice(maxValue);
    const stepX = this.series.length > 1 ? this.chartWidth / (this.series.length - 1) : 0;
    const toY = (value: number) => this.chartHeight - (value / niceMax) * this.chartHeight;

    const points = this.series.map((p, i) => ({ x: i * stepX, y: toY(p.value) }));
    const line = this.smoothPath(points);
    const area = points.length
      ? `${line} L ${points[points.length - 1].x.toFixed(1)} ${this.chartHeight} L 0 ${this.chartHeight} Z`
      : '';

    return { points, line, area, maxValue: niceMax };
  }

  get markerPoints() {
    return this.chartPoints.points.filter((_, i) => i % 2 === 0);
  }

  get yAxisLabels(): string[] {
    const max = this.chartPoints.maxValue;
    const steps = 4;
    const labels: string[] = [];
    for (let i = steps; i >= 0; i--) {
      labels.push(this.formatAxisQ((max / steps) * i));
    }
    return labels;
  }

  get xAxisTicks(): SeriesPoint[] {
    if (this.series.length <= 7) return this.series;
    const step = Math.max(1, Math.round((this.series.length - 1) / 6));
    const ticks: SeriesPoint[] = [];
    for (let i = 0; i < this.series.length; i += step) {
      ticks.push(this.series[i]);
    }
    const last = this.series[this.series.length - 1];
    if (ticks[ticks.length - 1] !== last) ticks.push(last);
    return ticks;
  }

  get donutGradient(): string {
    const total = this.distribution.reduce((sum, s) => sum + s.percent, 0);
    if (total === 0) return '#eef0f5';
    let acc = 0;
    const stops = this.distribution.map((slice) => {
      const start = acc;
      acc += slice.percent;
      return `${slice.color} ${start}% ${acc}%`;
    });
    return `conic-gradient(${stops.join(', ')})`;
  }

  get currentCategories(): ExpenseCategory[] {
    return this.categories;
  }

  // ---------- Modal / formulario de egreso ----------
  showModal = false;
  expenseForm: FormGroup;
  isSaving = false;
  editingExpenseId: string | null = null;

  // ---------- NUEVO: modal / formulario de la meta de egresos ----------
  showGoalModal = false;
  goalForm: FormGroup;
  isSavingGoal = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private expenseService: ExpenseService,
    private expenseGoalService: ExpenseGoalService,
    private router: Router,
  ) {
    this.user = this.authService.getUser();
    this.expenseForm = this.fb.group({
      description: ['', [Validators.required, Validators.minLength(3)]],
      category: ['Alimentación', [Validators.required]],
      amount: [null, [Validators.required, Validators.min(0.01)]],
      method: ['Efectivo', [Validators.required]],
      date: [this.todayIso(), [Validators.required, noFutureDateValidator()]],
    });

    this.goalForm = this.fb.group({
      amount: [this.metaEgresos, [Validators.required, Validators.min(0.01)]],
    });
  }

  ngOnInit(): void {
    this.loadExpenses();
  }

  get f() {
    return this.expenseForm.controls;
  }

  // NUEVO: getter para los controles del formulario de la meta (igual que "f" pero para "goalForm").
  get g() {
    return this.goalForm.controls;
  }

  private todayIso(): string {
    return localTodayIso();
  }

  // Usado en el template para poner max="..." en el <input type="date">,
  // así el selector de fecha del navegador ni siquiera deja elegir un día futuro.
  get maxDate(): string {
    return this.todayIso();
  }

  // Pide los egresos Y la meta al mismo tiempo (forkJoin espera a que ambas
  // respondan) para poder calcular metaPercent/metaLabel con el valor real
  // de la meta desde el primer render, sin parpadeos.
  loadExpenses(): void {
    this.isLoading = true;
    forkJoin({
      summary: this.expenseService.getSummary(),
      goal: this.expenseGoalService.get(),
    }).subscribe({
      next: ({ summary, goal }) => {
        this.metaEgresos = goal.data.amount;
        this.applySummary(summary.data.expenses);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error cargando egresos', err);
        this.isLoading = false;
      },
    });
  }

  private applySummary(expenses: Expense[]): void {
    this.allExpenses = expenses;
    this.recentExpenses = expenses.map((e) => ({
      id: e.id,
      description: e.description,
      category: e.category,
      date: this.formatDate(e.date),
      amount: e.amount,
      method: e.method,
    }));

    const now = new Date();
    const thisMonthKey = this.monthKey(now);
    const lastMonthKey = this.monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));

    const thisMonthExpenses = expenses.filter((e) => e.date.slice(0, 7) === thisMonthKey);
    const lastMonthExpenses = expenses.filter((e) => e.date.slice(0, 7) === lastMonthKey);

    const totalThisMonth = thisMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalLastMonth = lastMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

    this.totalEgresos = this.formatQ(totalThisMonth);
    this.egresosRegistrados = thisMonthExpenses.length;

    if (totalLastMonth > 0) {
      const change = ((totalThisMonth - totalLastMonth) / totalLastMonth) * 100;
      const arrow = change >= 0 ? '▲' : '▼';
      this.totalTrend = `${arrow} ${Math.abs(change).toFixed(1)}% vs mes anterior`;
    } else {
      this.totalTrend = totalThisMonth > 0 ? '▲ Nuevo este mes' : '';
    }

    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysElapsed = thisMonthKey === this.monthKey(now) ? now.getDate() : daysInMonth;
    this.promedioDiario = this.formatQ(daysElapsed > 0 ? totalThisMonth / daysElapsed : 0);

    // Usa this.metaEgresos, que ya viene del backend (o del valor por
    // defecto que envía la API si el usuario nunca la ha configurado).
    this.metaPercent = this.metaEgresos > 0 ? Math.min(100, Math.round((totalThisMonth / this.metaEgresos) * 100)) : 0;
    this.metaLabel = `${this.formatQ(totalThisMonth)} de ${this.formatQ(this.metaEgresos)}`;

    this.distribution = this.categories.map((cat) => {
      const amount = thisMonthExpenses.filter((e) => e.category === cat).reduce((sum, e) => sum + e.amount, 0);
      const percent = totalThisMonth > 0 ? Math.round((amount / totalThisMonth) * 100) : 0;
      return { label: cat, amount: this.formatQ(amount), percent, color: this.categoryColors[cat] };
    });

    this.topPaymentMethod = this.computeTopPaymentMethod(thisMonthExpenses, totalThisMonth);
    this.highestExpense = this.computeHighestExpense(thisMonthExpenses);

    this.availableMonths = this.buildAvailableMonths(expenses);
    this.series = this.buildSeries(expenses, this.selectedMonthKey);
  }

  // Método de pago con mayor monto acumulado este mes. Es información NUEVA
  // en el panel (no está en la dona de categorías ni en la tabla completa).
  private computeTopPaymentMethod(expenses: Expense[], total: number): TopPaymentMethodView | null {
    if (expenses.length === 0) return null;

    const byMethod = new Map<string, { amount: number; count: number }>();
    expenses.forEach((e) => {
      const entry = byMethod.get(e.method) ?? { amount: 0, count: 0 };
      entry.amount += e.amount;
      entry.count += 1;
      byMethod.set(e.method, entry);
    });

    const [label, stats] = [...byMethod.entries()].sort((a, b) => b[1].amount - a[1].amount)[0];
    return {
      label,
      amount: this.formatQ(stats.amount),
      percent: total > 0 ? Math.round((stats.amount / total) * 100) : 0,
      count: stats.count,
    };
  }

  // El egreso individual más alto del mes: ayuda a detectar gastos grandes
  // de un vistazo, sin tener que revisar toda la tabla de "Últimos egresos".
  private computeHighestExpense(expenses: Expense[]): HighestExpenseView | null {
    if (expenses.length === 0) return null;

    const top = expenses.reduce((max, e) => (e.amount > max.amount ? e : max), expenses[0]);
    return {
      description: top.description,
      category: top.category,
      amount: this.formatQ(top.amount),
      date: this.formatDate(top.date),
    };
  }

  private buildSeries(expenses: Expense[], monthKey?: string): SeriesPoint[] {
    const [year, month] = (monthKey ?? this.monthKey(new Date())).split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    const byDay = new Array(daysInMonth + 1).fill(0);
    expenses.forEach((exp) => {
      const [y, m, d] = exp.date.split('-').map(Number);
      if (y === year && m === month && d >= 1 && d <= daysInMonth) {
        byDay[d] += exp.amount;
      }
    });

    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      return { day, label: `${day} ${meses[month - 1]}`, value: byDay[day] };
    });
  }

  private monthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  onMonthChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedMonthKey = value;
    this.series = this.buildSeries(this.allExpenses, value);
  }

  private smoothPath(points: { x: number; y: number }[]): string {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

      let cp1x = p1.x + (p2.x - p0.x) / 6;
      let cp1y = p1.y + (p2.y - p0.y) / 6;
      let cp2x = p2.x - (p3.x - p1.x) / 6;
      let cp2y = p2.y - (p3.y - p1.y) / 6;

      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);
      cp1y = Math.min(Math.max(cp1y, minY), maxY);
      cp2y = Math.min(Math.max(cp2y, minY), maxY);

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  }

  private roundUpNice(value: number): number {
    if (value <= 0) return 100;
    const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    const residual = value / magnitude;
    let niceResidual = 1;
    if (residual > 5) niceResidual = 10;
    else if (residual > 2) niceResidual = 5;
    else if (residual > 1) niceResidual = 2;
    return niceResidual * magnitude;
  }

  private formatDate(iso: string): string {
    const [y, m, d] = iso.split('-');
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${Number(d)} ${meses[Number(m) - 1]} ${y}`;
  }

  private formatQ(value: number): string {
    return 'Q ' + value.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private formatAxisQ(value: number): string {
    return 'Q ' + Math.round(value).toLocaleString('es-GT');
  }

  toggleShowAll(): void {
    this.showAllExpenses = !this.showAllExpenses;
  }

  openModal(): void {
    this.editingExpenseId = null;
    this.expenseForm.reset({
      description: '',
      category: 'Alimentación',
      amount: null,
      method: 'Efectivo',
      date: this.todayIso(),
    });
    this.showModal = true;
  }

  openEditModal(expenseView: RecentExpenseView): void {
    const expense = this.allExpenses.find((e) => e.id === expenseView.id);
    if (!expense) return;

    this.editingExpenseId = expense.id;
    this.expenseForm.reset({
      description: expense.description,
      category: expense.category,
      amount: expense.amount,
      method: expense.method,
      date: expense.date,
    });
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingExpenseId = null;
  }

  submitExpense(): void {
    if (this.expenseForm.invalid) {
      this.expenseForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    const { description, category, amount, method, date } = this.expenseForm.value;
    const payload = { description, category, amount: Number(amount), method, date };

    const request$ = this.editingExpenseId
      ? this.expenseService.update(this.editingExpenseId, payload)
      : this.expenseService.create(payload);

    request$.subscribe({
      next: () => {
        this.isSaving = false;
        this.showModal = false;
        this.editingExpenseId = null;
        this.loadExpenses();
      },
      error: (err) => {
        console.error('Error guardando egreso', err);
        this.isSaving = false;
      },
    });
  }

  deleteExpense(expenseView: RecentExpenseView): void {
    const confirmado = confirm(`¿Eliminar el egreso "${expenseView.description}"? Esta acción no se puede deshacer.`);
    if (!confirmado) return;

    this.expenseService.delete(expenseView.id).subscribe({
      next: () => this.loadExpenses(),
      error: (err) => console.error('Error eliminando egreso', err),
    });
  }

  // ---------- NUEVO: abrir / cerrar / guardar la meta de egresos ----------

  openGoalModal(): void {
    this.goalForm.reset({ amount: this.metaEgresos });
    this.showGoalModal = true;
  }

  closeGoalModal(): void {
    this.showGoalModal = false;
  }

  submitGoal(): void {
    if (this.goalForm.invalid) {
      this.goalForm.markAllAsTouched();
      return;
    }

    this.isSavingGoal = true;
    const amount = Number(this.goalForm.value.amount);

    this.expenseGoalService.update({ amount }).subscribe({
      next: () => {
        this.metaEgresos = amount;
        this.isSavingGoal = false;
        this.showGoalModal = false;
        // Recalcula metaPercent/metaLabel con la nueva meta, sin volver a
        // pedir los egresos al backend (ya los tenemos en allExpenses).
        this.applySummary(this.allExpenses);
      },
      error: (err) => {
        console.error('Error guardando la meta de egresos', err);
        this.isSavingGoal = false;
      },
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}