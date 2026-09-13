import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { IncomeService } from '../../core/services/income.service';
import { ExpenseService } from '../../core/services/expense.service';
import { Income } from '../../core/models/income.model';
import { Expense } from '../../core/models/expense.model';

interface NavItem {
  icon: 'grid' | 'in' | 'out' | 'coffee' | 'list' | 'chart-pie' | 'chart-bar' | 'bell' | 'user' | 'gear';
  label: string;
  active?: boolean;
  route?: string;
}

type TransactionType = 'Ingreso' | 'Egreso';

interface TransactionView {
  id: string;
  date: string; // YYYY-MM-DD, para ordenar y filtrar
  dateLabel: string;
  description: string;
  category: string;
  type: TransactionType;
  amount: number;
  method: string;
}

interface SeriesPoint {
  day: number;
  label: string;
  ingresos: number;
  egresos: number;
}

type RangeOption = '7' | '30' | 'mes';
type TypeFilter = 'todos' | 'Ingreso' | 'Egreso';

// Fecha de HOY en horario LOCAL, formato YYYY-MM-DD.
function localTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function firstDayOfMonthIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

@Component({
  selector: 'app-transacciones',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './transacciones.component.html',
  styleUrl: './transacciones.component.css',

  
})


export class TransaccionesComponent implements OnInit {
  user: ReturnType<AuthService['getUser']>;

  navItems: NavItem[] = [
    { icon: 'grid', label: 'Vista General', route: '/dashboard' },
    { icon: 'in', label: 'Ingresos', route: '/ingresos' },
    { icon: 'out', label: 'Egresos', route: '/egresos' },
    { icon: 'coffee', label: 'Pequeños Consumos', route: '/pequenos-consumos' },
  ];
  navItemsSecondary: NavItem[] = [
    { icon: 'list', label: 'Transacciones', active: true, route: '/transacciones' },
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

  // Categorías combinadas (de Ingresos y Egresos) para el filtro "Categoría".
  readonly ingresoCategories = ['Salario', 'Renta', 'Pensión', 'Otro fijo', 'Freelance', 'Bonos', 'Ventas', 'Reembolsos', 'Otro variable'];
  readonly egresoCategories = ['Alimentación', 'Transporte', 'Vivienda', 'Servicios', 'Otros', 'Pequeños consumos'];
  get allCategories(): string[] {
    return [...this.ingresoCategories, ...this.egresoCategories];
    
  }


  isLoading = false;

  // ---------- KPIs (calculados sobre EL MES ACTUAL, excepto el saldo) ----------
  totalIngresos = 'Q 0.00';
  totalIngresosTrend = '';
  totalEgresos = 'Q 0.00';
  totalEgresosTrend = '';
  saldoDisponible = 'Q 0.00'; // acumulado histórico, igual que el cálculo del backend
  totalTransacciones = 0;
  totalTransaccionesTrend = '';

  // ---------- Donut: Ingresos vs Egresos del mes ----------
  donutSlices: { label: TransactionType; amount: string; percent: number; color: string }[] = [];
  donutTotal = 'Q 0.00';
  readonly typeColors: Record<TransactionType, string> = {
    Ingreso: '#12B5A0',
    Egreso: '#5B4FE8',

    
  };

  // ---------- Gráfica "Flujo de movimientos" ----------
  rangeOption: RangeOption = '30';
  series: SeriesPoint[] = [];
  private readonly chartWidth = 650;
  private readonly chartHeight = 200;

  // ---------- Todas las transacciones combinadas (sin filtrar) ----------
  private allTransactions: TransactionView[] = [];

  // ---------- Filtros (afectan la tabla "Últimas transacciones") ----------
  filterDateFrom = firstDayOfMonthIso();
  filterDateTo = localTodayIso();
  filterType: TypeFilter = 'todos';
  filterCategory = 'todas';
  showAllTransactions = false;

    constructor(
    private authService: AuthService,
    private incomeService: IncomeService,
    private expenseService: ExpenseService,
    private router: Router,
  ) {
    this.user = this.authService.getUser();
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading = true;
    forkJoin({
      incomeSummary: this.incomeService.getSummary(),
      expenseSummary: this.expenseService.getSummary(),
    }).subscribe({
      next: ({ incomeSummary, expenseSummary }) => {
        this.applyData(incomeSummary.data.incomes, expenseSummary.data.expenses);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error cargando transacciones', err);
        this.isLoading = false;
      },
    });
  }

  private applyData(incomes: Income[], expenses: Expense[]): void {
    const incomeViews: TransactionView[] = incomes.map((i) => ({
      id: i.id,
      date: i.date,
      dateLabel: this.formatDate(i.date),
      description: i.title,
      category: i.category,
      type: 'Ingreso',
      amount: i.amount,
      method: i.method,
    }));

    const expenseViews: TransactionView[] = expenses.map((e) => ({
      id: e.id,
      date: e.date,
      dateLabel: this.formatDate(e.date),
      description: e.description,
      category: e.category,
      type: 'Egreso',
      amount: e.amount,
      method: e.method,
    }));

    this.allTransactions = [...incomeViews, ...expenseViews].sort((a, b) => (a.date < b.date ? 1 : -1));

    const now = new Date();
    const thisMonthKey = this.monthKey(now);
    const lastMonthKey = this.monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));

    const thisMonthIncomes = incomes.filter((i) => i.date.slice(0, 7) === thisMonthKey);
    const lastMonthIncomes = incomes.filter((i) => i.date.slice(0, 7) === lastMonthKey);
    const thisMonthExpenses = expenses.filter((e) => e.date.slice(0, 7) === thisMonthKey);
    const lastMonthExpenses = expenses.filter((e) => e.date.slice(0, 7) === lastMonthKey);

    const totalIngresosThisMonth = thisMonthIncomes.reduce((sum, i) => sum + i.amount, 0);
    const totalIngresosLastMonth = lastMonthIncomes.reduce((sum, i) => sum + i.amount, 0);
    const totalEgresosThisMonth = thisMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalEgresosLastMonth = lastMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

    this.totalIngresos = this.formatQ(totalIngresosThisMonth);
    this.totalIngresosTrend = this.trendLabel(totalIngresosThisMonth, totalIngresosLastMonth);
    this.totalEgresos = this.formatQ(totalEgresosThisMonth);
    this.totalEgresosTrend = this.trendLabel(totalEgresosThisMonth, totalEgresosLastMonth);

    // Saldo disponible = acumulado histórico total (igual que el cálculo
    // que usa el backend para validar egresos), no solo el mes actual.
    const totalIngresosAllTime = incomes.reduce((sum, i) => sum + i.amount, 0);
    const totalEgresosAllTime = expenses.reduce((sum, e) => sum + e.amount, 0);
    this.saldoDisponible = this.formatQ(totalIngresosAllTime - totalEgresosAllTime, '$');

    const countThisMonth = thisMonthIncomes.length + thisMonthExpenses.length;
    const countLastMonth = lastMonthIncomes.length + lastMonthExpenses.length;
    this.totalTransacciones = countThisMonth;
    this.totalTransaccionesTrend = this.trendLabel(countThisMonth, countLastMonth, false);

    const combinedTotal = totalIngresosThisMonth + totalEgresosThisMonth;
    this.donutTotal = this.formatQ(combinedTotal);
    this.donutSlices = (['Ingreso', 'Egreso'] as TransactionType[]).map((type) => {
      const amount = type === 'Ingreso' ? totalIngresosThisMonth : totalEgresosThisMonth;
      const percent = combinedTotal > 0 ? Math.round((amount / combinedTotal) * 100) : 0;
      return { label: type, amount: this.formatQ(amount), percent, color: this.typeColors[type] };
    });

    this.series = this.buildSeries(incomes, expenses, this.rangeOption);
  }

  private trendLabel(current: number, previous: number, isCurrency = true): string {
    if (previous > 0) {
      const change = ((current - previous) / previous) * 100;
      const arrow = change >= 0 ? '▲' : '▼';
      return `${arrow} ${Math.abs(change).toFixed(1)}% vs mes anterior`;
    }
    return current > 0 ? '▲ Nuevo este mes' : '';
  }

  // ---------- Gráfica ----------
  onRangeChange(event: Event): void {
    this.rangeOption = (event.target as HTMLSelectElement).value as RangeOption;
    const incomes = this.allTransactions.filter((t) => t.type === 'Ingreso');
    // Reconstruye desde allTransactions ya combinado no sirve para el chart
    // (necesita los objetos originales), así que se recalcula desde
    // allTransactions dividiendo por tipo con los mismos campos.
    this.series = this.buildSeriesFromViews(this.allTransactions, this.rangeOption);
  }

  private buildSeries(incomes: Income[], expenses: Expense[], range: RangeOption): SeriesPoint[] {
    const combined: TransactionView[] = [
      ...incomes.map((i) => ({ date: i.date, type: 'Ingreso' as TransactionType, amount: i.amount, id: i.id, dateLabel: '', description: '', category: '', method: '' })),
      ...expenses.map((e) => ({ date: e.date, type: 'Egreso' as TransactionType, amount: e.amount, id: e.id, dateLabel: '', description: '', category: '', method: '' })),
    ];
    return this.buildSeriesFromViews(combined, range);
  }

  private buildSeriesFromViews(items: TransactionView[], range: RangeOption): SeriesPoint[] {
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const today = new Date();
    let start: Date;

    if (range === 'mes') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    } else {
      const days = range === '7' ? 6 : 29;
      start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
    }

    const days: SeriesPoint[] = [];
    const cursor = new Date(start);
    while (cursor <= today) {
      const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      const dayItems = items.filter((t) => t.date === iso);
      days.push({
        day: cursor.getDate(),
        label: `${cursor.getDate()} ${meses[cursor.getMonth()]}`,
        ingresos: dayItems.filter((t) => t.type === 'Ingreso').reduce((sum, t) => sum + t.amount, 0),
        egresos: dayItems.filter((t) => t.type === 'Egreso').reduce((sum, t) => sum + t.amount, 0),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }

  get chartPoints() {
    const maxValue = Math.max(...this.series.map((p) => Math.max(p.ingresos, p.egresos)), 1);
    const niceMax = this.roundUpNice(maxValue);
    const stepX = this.series.length > 1 ? this.chartWidth / (this.series.length - 1) : 0;
    const toY = (value: number) => this.chartHeight - (value / niceMax) * this.chartHeight;

    const ingresosPoints = this.series.map((p, i) => ({ x: i * stepX, y: toY(p.ingresos) }));
    const egresosPoints = this.series.map((p, i) => ({ x: i * stepX, y: toY(p.egresos) }));

    return {
      ingresosLine: this.smoothPath(ingresosPoints),
      egresosLine: this.smoothPath(egresosPoints),
      maxValue: niceMax,
    };
  }

  get yAxisLabels(): string[] {
    const max = this.chartPoints.maxValue;
    const steps = 4;
    const labels: string[] = [];
    for (let i = steps; i >= 0; i--) labels.push(this.formatAxisQ((max / steps) * i));
    return labels;
  }

  get xAxisTicks(): SeriesPoint[] {
    if (this.series.length <= 7) return this.series;
    const step = Math.max(1, Math.round((this.series.length - 1) / 6));
    const ticks: SeriesPoint[] = [];
    for (let i = 0; i < this.series.length; i += step) ticks.push(this.series[i]);
    const last = this.series[this.series.length - 1];
    if (ticks[ticks.length - 1] !== last) ticks.push(last);
    return ticks;
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

  // ---------- Filtros sobre la tabla ----------
  get filteredTransactions(): TransactionView[] {
    return this.allTransactions.filter((t) => {
      if (t.date < this.filterDateFrom || t.date > this.filterDateTo) return false;
      if (this.filterType !== 'todos' && t.type !== this.filterType) return false;
      if (this.filterCategory !== 'todas' && t.category !== this.filterCategory) return false;
      return true;
    });
  }

  get visibleTransactions(): TransactionView[] {
    const list = this.filteredTransactions;
    return this.showAllTransactions ? list : list.slice(0, 5);
  }

  setTypeFilter(type: TypeFilter): void {
    this.filterType = type;
  }

  toggleShowAll(): void {
    this.showAllTransactions = !this.showAllTransactions;
  }

  resetFilters(): void {
    this.filterDateFrom = firstDayOfMonthIso();
    this.filterDateTo = localTodayIso();
    this.filterType = 'todos';
    this.filterCategory = 'todas';
  }

  private monthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private formatDate(iso: string): string {
    const [y, m, d] = iso.split('-');
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${Number(d)} ${meses[Number(m) - 1]} ${y}`;
  }

  private formatQ(value: number, prefix: 'Q' | '$' = 'Q'): string {
    return `${prefix} ` + value.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private formatAxisQ(value: number): string {
    return 'Q ' + Math.round(value).toLocaleString('es-GT');
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}