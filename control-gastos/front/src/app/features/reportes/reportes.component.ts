import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { IncomeService } from '../../core/services/income.service';
import { ExpenseService } from '../../core/services/expense.service';
import { Income } from '../../core/models/income.model';
import { Expense, ExpenseCategory } from '../../core/models/expense.model';

interface NavItem {
  icon: 'grid' | 'in' | 'out' | 'coffee' | 'list' | 'chart-pie' | 'chart-bar' | 'bell' | 'user' | 'gear';
  label: string;
  active?: boolean;
  route?: string;
}

type RangeOption = '7' | '30' | '90' | '180' | '365';

interface SeriesPoint {
  label: string;
  ingresos: number;
  egresos: number;
}

interface CategoryBarRow {
  category: ExpenseCategory;
  thisMonth: number;
  lastMonth: number;
}

interface MonthlyBalanceRow {
  label: string;
  ingresos: number;
  egresos: number;
}

interface Insight {
  icon: 'up' | 'down' | 'check' | 'target';
  tone: 'pink' | 'teal' | 'blue' | 'purple';
  text: string;
}

const RANGE_DAYS: Record<RangeOption, number> = { '7': 7, '30': 30, '90': 90, '180': 182, '365': 365 };

const EXPENSE_CATEGORIES: ExpenseCategory[] = ['Alimentación', 'Transporte', 'Vivienda', 'Servicios', 'Otros', 'Pequeños consumos'];

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  Alimentación: '#12B5A0',
  Transporte: '#5B4FE8',
  Vivienda: '#3B82F6',
  Servicios: '#8B5CF6',
  Otros: '#C084FC',
  'Pequeños consumos': '#F59E0B',
};

function toIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDayLabel(date: Date): string {
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${date.getDate()} ${meses[date.getMonth()]}`;
}

function formatRangeLabel(from: Date, to: Date): string {
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const f = `${from.getDate()} ${meses[from.getMonth()]} ${from.getFullYear()}`;
  const t = `${to.getDate()} ${meses[to.getMonth()]} ${to.getFullYear()}`;
  return `${f} - ${t}`;
}

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './reportes.component.html',
  styleUrl: './reportes.component.css',
})
export class ReportesComponent implements OnInit {
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
    { icon: 'chart-bar', label: 'Reportes', active: true, route: '/reportes' },
    { icon: 'bell', label: 'Notificaciones', route: '/notificaciones' },
  ];
  navItemsAccount: NavItem[] = [
    { icon: 'user', label: 'Cuenta' },
    { icon: 'gear', label: 'Ajustes' },
  ];

  readonly rangeOptions: { value: RangeOption; label: string }[] = [
    { value: '7', label: '7 días' },
    { value: '30', label: '30 días' },
    { value: '90', label: '3 meses' },
    { value: '180', label: '6 meses' },
    { value: '365', label: '1 año' },
  ];
  readonly categories = EXPENSE_CATEGORIES;
  readonly categoryColors = CATEGORY_COLORS;

  isLoading = false;
  rangeOption: RangeOption = '30';
  rangeLabel = '';

  // ---------- KPIs (sobre el rango seleccionado, excepto el saldo) ----------
  totalIngresos = 'Q 0.00';
  totalIngresosTrend = '';
  totalEgresos = 'Q 0.00';
  totalEgresosTrend = '';
  saldoDisponible = 'Q 0.00'; // acumulado histórico, no depende del rango
  saldoTrend = '';
  totalTransacciones = 0;
  totalTransaccionesTrend = '';

  // ---------- Evolución de ingresos y egresos ----------
  series: SeriesPoint[] = [];
  private readonly chartWidth = 650;
  private readonly chartHeight = 200;

  // ---------- Distribución de gasto por categoría (dona) ----------
  donutSlices: { category: ExpenseCategory; amount: string; percent: number; color: string }[] = [];
  donutTotal = 'Q 0.00';

  // ---------- Hábitos de consumo (Este mes vs Mes anterior) ----------
  habitRows: CategoryBarRow[] = [];
  private readonly habitBarMaxHeight = 170;

  // ---------- Balance mensual (últimos 6 meses) ----------
  balanceRows: MonthlyBalanceRow[] = [];
  private readonly balanceBarMaxHeight = 150;

  // ---------- Insights ----------
  insights: Insight[] = [];

  private allIncomes: Income[] = [];
  private allExpenses: Expense[] = [];

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
        this.allIncomes = incomeSummary.data.incomes;
        this.allExpenses = expenseSummary.data.expenses;
        this.recalculateAll();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error cargando reportes', err);
        this.isLoading = false;
      },
    });
  }

  onRangeSelect(option: RangeOption): void {
    this.rangeOption = option;
    this.recalculateAll();
  }

  private recalculateAll(): void {
    const { from, to } = this.currentRangeDates();
    this.rangeLabel = formatRangeLabel(from, to);

    const { from: prevFrom, to: prevTo } = this.previousRangeDates(from, to);

    const incomesInRange = this.allIncomes.filter((i) => i.date >= toIso(from) && i.date <= toIso(to));
    const expensesInRange = this.allExpenses.filter((e) => e.date >= toIso(from) && e.date <= toIso(to));
    const incomesInPrevRange = this.allIncomes.filter((i) => i.date >= toIso(prevFrom) && i.date <= toIso(prevTo));
    const expensesInPrevRange = this.allExpenses.filter((e) => e.date >= toIso(prevFrom) && e.date <= toIso(prevTo));

    const totalIngresos = incomesInRange.reduce((sum, i) => sum + i.amount, 0);
    const totalIngresosPrev = incomesInPrevRange.reduce((sum, i) => sum + i.amount, 0);
    const totalEgresos = expensesInRange.reduce((sum, e) => sum + e.amount, 0);
    const totalEgresosPrev = expensesInPrevRange.reduce((sum, e) => sum + e.amount, 0);

    this.totalIngresos = this.formatQ(totalIngresos);
    this.totalIngresosTrend = this.trendLabel(totalIngresos, totalIngresosPrev);
    this.totalEgresos = this.formatQ(totalEgresos);
    this.totalEgresosTrend = this.trendLabel(totalEgresos, totalEgresosPrev);

    const totalIngresosAllTime = this.allIncomes.reduce((sum, i) => sum + i.amount, 0);
    const totalEgresosAllTime = this.allExpenses.reduce((sum, e) => sum + e.amount, 0);
    const saldoActual = totalIngresosAllTime - totalEgresosAllTime;
    const saldoPrevio = saldoActual - (totalIngresos - totalEgresos) + (totalIngresosPrev - totalEgresosPrev);
    this.saldoDisponible = this.formatQ(saldoActual, '$');
    this.saldoTrend = this.trendLabel(saldoActual, saldoPrevio);

    const countInRange = incomesInRange.length + expensesInRange.length;
    const countInPrevRange = incomesInPrevRange.length + expensesInPrevRange.length;
    this.totalTransacciones = countInRange;
    this.totalTransaccionesTrend = this.trendLabel(countInRange, countInPrevRange, false);

    this.series = this.buildSeries(incomesInRange, expensesInRange, from, to);

    this.donutTotal = this.formatQ(totalEgresos);
    this.donutSlices = this.categories
      .map((cat) => ({
        category: cat,
        spent: expensesInRange.filter((e) => e.category === cat).reduce((sum, e) => sum + e.amount, 0),
      }))
      .filter((c) => c.spent > 0)
      .map((c) => ({
        category: c.category,
        amount: this.formatQ(c.spent),
        percent: totalEgresos > 0 ? Math.round((c.spent / totalEgresos) * 100) : 0,
        color: this.categoryColors[c.category],
      }));

    this.buildHabitRows();
    this.buildBalanceRows();
    this.buildInsights();
  }

  // ---------- Fechas ----------
  private currentRangeDates(): { from: Date; to: Date } {
    const to = new Date();
    const days = RANGE_DAYS[this.rangeOption];
    const from = new Date();
    from.setDate(to.getDate() - (days - 1));
    return { from, to };
  }

  private previousRangeDates(from: Date, to: Date): { from: Date; to: Date } {
    const days = RANGE_DAYS[this.rangeOption];
    const prevTo = new Date(from);
    prevTo.setDate(from.getDate() - 1);
    const prevFrom = new Date(prevTo);
    prevFrom.setDate(prevTo.getDate() - (days - 1));
    return { from: prevFrom, to: prevTo };
  }

  private trendLabel(current: number, previous: number, isCurrency = true): string {
    if (previous > 0) {
      const change = ((current - previous) / previous) * 100;
      const arrow = change >= 0 ? '▲' : '▼';
      return `${arrow} ${Math.abs(change).toFixed(1)}% vs periodo anterior`;
    }
    return current > 0 ? '▲ Nuevo en este periodo' : '';
  }

  // ---------- Gráfica "Evolución de ingresos y egresos" ----------
  private buildSeries(incomes: Income[], expenses: Expense[], from: Date, to: Date): SeriesPoint[] {
    const days: SeriesPoint[] = [];
    const cursor = new Date(from);
    while (cursor <= to) {
      const iso = toIso(cursor);
      days.push({
        label: formatDayLabel(cursor),
        ingresos: incomes.filter((i) => i.date === iso).reduce((sum, i) => sum + i.amount, 0),
        egresos: expenses.filter((e) => e.date === iso).reduce((sum, e) => sum + e.amount, 0),
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

    const ingresosLine = this.smoothPath(ingresosPoints);
    const egresosLine = this.smoothPath(egresosPoints);
    const ingresosArea = ingresosPoints.length
      ? `${ingresosLine} L ${ingresosPoints[ingresosPoints.length - 1].x.toFixed(1)} ${this.chartHeight} L 0 ${this.chartHeight} Z`
      : '';
    const egresosArea = egresosPoints.length
      ? `${egresosLine} L ${egresosPoints[egresosPoints.length - 1].x.toFixed(1)} ${this.chartHeight} L 0 ${this.chartHeight} Z`
      : '';

    return { ingresosLine, egresosLine, ingresosArea, egresosArea, maxValue: niceMax };
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

  // ---------- Hábitos de consumo: Este mes vs Mes anterior (calendario fijo) ----------
  private buildHabitRows(): void {
    const now = new Date();
    const thisMonthKey = this.monthKey(now);
    const lastMonthKey = this.monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));

    this.habitRows = this.categories.map((cat) => ({
      category: cat,
      thisMonth: this.allExpenses.filter((e) => e.category === cat && e.date.slice(0, 7) === thisMonthKey).reduce((sum, e) => sum + e.amount, 0),
      lastMonth: this.allExpenses.filter((e) => e.category === cat && e.date.slice(0, 7) === lastMonthKey).reduce((sum, e) => sum + e.amount, 0),
    }));
  }

  get habitBarMax(): number {
    const values = this.habitRows.flatMap((r) => [r.thisMonth, r.lastMonth]);
    return Math.max(...values, 100);
  }

  habitBarHeight(value: number): number {
    return this.habitBarMax > 0 ? Math.round((value / this.habitBarMax) * this.habitBarMaxHeight) : 0;
  }

  // ---------- Balance mensual: últimos 6 meses (calendario fijo) ----------
  private buildBalanceRows(): void {
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const rows: MonthlyBalanceRow[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = this.monthKey(d);
      rows.push({
        label: meses[d.getMonth()],
        ingresos: this.allIncomes.filter((inc) => inc.date.slice(0, 7) === key).reduce((sum, inc) => sum + inc.amount, 0),
        egresos: this.allExpenses.filter((exp) => exp.date.slice(0, 7) === key).reduce((sum, exp) => sum + exp.amount, 0),
      });
    }
    this.balanceRows = rows;
  }

  get balanceBarMax(): number {
    const values = this.balanceRows.flatMap((r) => [r.ingresos, r.egresos]);
    return Math.max(...values, 100);
  }

  balanceBarHeight(value: number): number {
    return this.balanceBarMax > 0 ? Math.round((value / this.balanceBarMax) * this.balanceBarMaxHeight) : 0;
  }

  // ---------- Insights (reglas simples, no IA) ----------
  private buildInsights(): void {
    const insights: Insight[] = [];

    const rowsWithLastMonth = this.habitRows.filter((r) => r.lastMonth > 0);
    if (rowsWithLastMonth.length > 0) {
      const sorted = [...rowsWithLastMonth].sort((a, b) => (b.thisMonth - b.lastMonth) / b.lastMonth - (a.thisMonth - a.lastMonth) / a.lastMonth);
      const biggestIncrease = sorted[0];
      const increasePercent = Math.round(((biggestIncrease.thisMonth - biggestIncrease.lastMonth) / biggestIncrease.lastMonth) * 100);
      if (increasePercent >= 10) {
        insights.push({ icon: 'up', tone: 'pink', text: `Tu gasto en ${biggestIncrease.category.toLowerCase()} aumentó un ${increasePercent}% respecto al mes anterior.` });
      }

      const biggestDecrease = sorted[sorted.length - 1];
      const decreasePercent = Math.round(((biggestDecrease.thisMonth - biggestDecrease.lastMonth) / biggestDecrease.lastMonth) * 100);
      if (decreasePercent <= -10) {
        insights.push({ icon: 'check', tone: 'teal', text: `Mantienes un buen control en ${biggestDecrease.category.toLowerCase()}, con una disminución del ${Math.abs(decreasePercent)}%.` });
      }
    }

    const totalIngresosAllTime = this.allIncomes.reduce((sum, i) => sum + i.amount, 0);
    const totalEgresosAllTime = this.allExpenses.reduce((sum, e) => sum + e.amount, 0);
    const saldoActual = totalIngresosAllTime - totalEgresosAllTime;

    if (this.saldoTrend.startsWith('▲')) {
      insights.push({ icon: 'up', tone: 'blue', text: `Tu saldo disponible mejoró respecto al periodo anterior, lo que indica una buena gestión de tus finanzas.` });
    } else if (this.saldoTrend.startsWith('▼')) {
      insights.push({ icon: 'down', tone: 'pink', text: `Tu saldo disponible bajó respecto al periodo anterior. Revisa en qué categorías estás gastando más.` });
    }

    if (saldoActual >= 0) {
      insights.push({ icon: 'target', tone: 'purple', text: '¡Vas por buen camino! Sigue manteniendo tus hábitos de consumo.' });
    } else {
      insights.push({ icon: 'target', tone: 'purple', text: 'Tu saldo disponible es negativo — considera ajustar tus egresos este mes.' });
    }

    this.insights = insights.slice(0, 4);
  }

  private monthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
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