import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { IncomeService } from '../../core/services/income.service';
import { ExpenseService } from '../../core/services/expense.service';
import { Income } from '../../core/models/income.model';
import { Expense, ExpenseCategory } from '../../core/models/expense.model';

interface KpiCard {
  icon: 'in' | 'out' | 'coffee' | 'wallet';
  label: string;
  amount: string;
  trend?: string;
  note: string;
  tone: 'green' | 'purple' | 'blue' | 'teal';
}

interface SeriesPoint {
  month: string;
  ingresos: number;
  egresos: number;
  consumos: number;
}

interface ExpenseSlice {
  label: ExpenseCategory;
  amount: string;
  percent: number;
  color: string;
}

interface FrequentItem {
  icon: 'coffee' | 'snack' | 'drink' | 'bakery' | 'other';
  label: string;
  amount: string;
  percentOfMax: number;
}

interface Transaction {
  icon: 'in' | 'out' | 'coffee';
  title: string;
  subtitle: string;
  amount: string;
  positive: boolean;
  date: string;
  isoDate: string; // se usa solo para ordenar; no se pinta en la vista
}

interface NavItem {
  icon: 'grid' | 'in' | 'out' | 'coffee' | 'list' | 'chart-pie' | 'chart-bar' | 'bell' | 'user' | 'gear' | 'logout';
  label: string;
  active?: boolean;
  route?: string;
}

/**
 * Vista general del Dashboard.
 * Consume IncomeService Y ExpenseService juntos (con forkJoin) para que los 4
 * KPIs, la gráfica mensual, la distribución por categoría y las transacciones
 * recientes queden sincronizados con AMBAS tablas de la base de datos.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  user: ReturnType<AuthService['getUser']>;

  navItems: NavItem[] = [
    { icon: 'grid', label: 'Vista General', active: true, route: '/dashboard' },
    { icon: 'in', label: 'Ingresos', route: '/ingresos' },
    { icon: 'out', label: 'Egresos', route: '/egresos' },
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

  kpis: KpiCard[] = [
    { icon: 'in', label: 'Ingresos', amount: 'Q 0.00', note: 'Este mes', tone: 'green' },
    { icon: 'out', label: 'Egresos', amount: 'Q 0.00', note: 'Este mes', tone: 'purple' },
    { icon: 'coffee', label: 'Pequeños Consumos', amount: 'Q 0.00', note: 'Este mes', tone: 'blue' },
    { icon: 'wallet', label: 'Saldo Disponible', amount: 'Q 0.00', note: 'Este mes', tone: 'teal' },
  ];

  // Se inicializa con los últimos 6 meses reales (terminando en el mes
  // actual), no con meses fijos "Ene..Jun".
  series: SeriesPoint[] = this.buildMonthlySeries([], []);

  readonly categoryColors: Record<ExpenseCategory, string> = {
    Alimentación: '#12B5A0',
    Transporte: '#5B4FE8',
    Vivienda: '#3B82F6',
    Servicios: '#8B5CF6',
    Otros: '#C084FC',
  };

  expenseDistribution: ExpenseSlice[] = (['Alimentación', 'Transporte', 'Vivienda', 'Servicios', 'Otros'] as ExpenseCategory[]).map((cat) => ({
    label: cat,
    amount: 'Q 0.00',
    percent: 0,
    color: this.categoryColors[cat],
  }));

  frequentConsumptions: FrequentItem[] = [];

  transactions: Transaction[] = [];

  private readonly chartWidth = 640;
  private readonly chartHeight = 220;
  private readonly maxValue = 10000;

  private totalIngresosValue = 0;
  private totalEgresosValue = 0;

  get chartPoints() {
    const stepX = this.chartWidth / (this.series.length - 1);
    const toY = (value: number) => this.chartHeight - (value / this.maxValue) * this.chartHeight;

    const build = (key: 'ingresos' | 'egresos' | 'consumos') =>
      this.series.map((point, i) => ({ x: i * stepX, y: toY(point[key]) }));

    const toPath = (points: { x: number; y: number }[]) =>
      points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

    const ingresos = build('ingresos');
    const egresos = build('egresos');
    const consumos = build('consumos');

    return {
      width: this.chartWidth,
      height: this.chartHeight,
      ingresosPath: toPath(ingresos),
      egresosPath: toPath(egresos),
      consumosPath: toPath(consumos),
      ingresos,
      egresos,
      consumos,
    };
  }

  get donutGradient(): string {
    const total = this.expenseDistribution.reduce((sum, slice) => sum + slice.percent, 0);
    if (this.expenseDistribution.length === 0 || total === 0) {
      return '#eef0f5';
    }
    let acc = 0;
    const stops = this.expenseDistribution.map((slice) => {
      const start = acc;
      acc += slice.percent;
      return `${slice.color} ${start}% ${acc}%`;
    });
    return `conic-gradient(${stops.join(', ')})`;
  }

  get totalEgresos(): string {
    return this.formatQ(this.totalEgresosValue);
  }

  constructor(
    private authService: AuthService,
    private router: Router,
    private incomeService: IncomeService,
    private expenseService: ExpenseService,
  ) {
    this.user = this.authService.getUser();
  }

  ngOnInit(): void {
    this.loadDashboard();
  }

  // Pide ingresos Y egresos al mismo tiempo (forkJoin espera a que ambas
  // peticiones terminen) para poder cruzar la información en un solo lugar
  // y no repintar la pantalla dos veces.
  private loadDashboard(): void {
    forkJoin({
      incomeSummary: this.incomeService.getSummary(),
      expenseSummary: this.expenseService.getSummary(),
    }).subscribe({
      next: ({ incomeSummary, expenseSummary }) => {
        this.applyDashboardData(incomeSummary.data.incomes, expenseSummary.data.expenses);
      },
      error: (err) => {
        console.error('Error cargando datos del dashboard', err);
      },
    });
  }

  private applyDashboardData(incomes: Income[], expenses: Expense[]): void {
    const now = new Date();
    const thisMonthKey = this.monthKey(now);

    const incomesThisMonth = incomes.filter((i) => i.date.slice(0, 7) === thisMonthKey);
    const expensesThisMonth = expenses.filter((e) => e.date.slice(0, 7) === thisMonthKey);

    this.totalIngresosValue = incomesThisMonth.reduce((sum, i) => sum + i.amount, 0);
    this.totalEgresosValue = expensesThisMonth.reduce((sum, e) => sum + e.amount, 0);
    const saldo = this.totalIngresosValue - this.totalEgresosValue;

    this.kpis = this.kpis.map((kpi, i) => {
      if (i === 0) return { ...kpi, amount: this.formatQ(this.totalIngresosValue) };
      if (i === 1) return { ...kpi, amount: this.formatQ(this.totalEgresosValue) };
      if (i === 3) return { ...kpi, amount: this.formatQ(saldo) };
      return kpi; // i === 2 (Pequeños Consumos) se queda en 0 hasta que exista ese módulo
    });

    this.series = this.buildMonthlySeries(incomes, expenses);

    const categories = Object.keys(this.categoryColors) as ExpenseCategory[];
    this.expenseDistribution = categories.map((cat) => {
      const amount = expensesThisMonth.filter((e) => e.category === cat).reduce((sum, e) => sum + e.amount, 0);
      const percent = this.totalEgresosValue > 0 ? Math.round((amount / this.totalEgresosValue) * 100) : 0;
      return { label: cat, amount: this.formatQ(amount), percent, color: this.categoryColors[cat] };
    });

    const incomeTx: Transaction[] = incomes.map((inc) => ({
      icon: 'in',
      title: inc.title,
      subtitle: inc.category,
      amount: '+' + this.formatQ(inc.amount),
      positive: true,
      date: this.formatDate(inc.date),
      isoDate: inc.date,
    }));

    const expenseTx: Transaction[] = expenses.map((exp) => ({
      icon: 'out',
      title: exp.description,
      subtitle: exp.category,
      amount: '-' + this.formatQ(exp.amount),
      positive: false,
      date: this.formatDate(exp.date),
      isoDate: exp.date,
    }));

    this.transactions = [...incomeTx, ...expenseTx]
      .sort((a, b) => b.isoDate.localeCompare(a.isoDate))
      .slice(0, 5);
  }

  // Construye los últimos 6 meses TERMINANDO en el mes actual (no meses
  // fijos), y suma ingresos/egresos que caen en cada uno.
  private buildMonthlySeries(incomes: Income[], expenses: Expense[]): SeriesPoint[] {
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const months: { label: string; monthIndex: number; year: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      months.push({ label: meses[d.getMonth()], monthIndex: d.getMonth(), year: d.getFullYear() });
    }

    const incomeTotalsByKey = new Map<string, number>();
    incomes.forEach((inc) => {
      const [y, m] = inc.date.split('-').map(Number);
      const key = `${y}-${m - 1}`;
      incomeTotalsByKey.set(key, (incomeTotalsByKey.get(key) ?? 0) + inc.amount);
    });

    const expenseTotalsByKey = new Map<string, number>();
    expenses.forEach((exp) => {
      const [y, m] = exp.date.split('-').map(Number);
      const key = `${y}-${m - 1}`;
      expenseTotalsByKey.set(key, (expenseTotalsByKey.get(key) ?? 0) + exp.amount);
    });

    return months.map((mo) => {
      const key = `${mo.year}-${mo.monthIndex}`;
      return {
        month: mo.label,
        ingresos: incomeTotalsByKey.get(key) ?? 0,
        egresos: expenseTotalsByKey.get(key) ?? 0,
        consumos: 0,
      };
    });
  }

  private monthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private formatQ(value: number): string {
    return 'Q ' + value.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private formatDate(iso: string): string {
    const [y, m, d] = iso.split('-');
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${Number(d)} ${meses[Number(m) - 1]} ${y}`;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}