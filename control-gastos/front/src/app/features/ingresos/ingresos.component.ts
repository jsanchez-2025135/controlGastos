import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { IncomeService } from '../../core/services/income.service';
import { Income } from '../../core/models/income.model';

interface NavItem {
  icon: 'grid' | 'in' | 'out' | 'coffee' | 'list' | 'chart-pie' | 'chart-bar' | 'bell' | 'user' | 'gear';
  label: string;
  active?: boolean;
  route?: string;
}

interface SourceCard {
  label: string;
  amount: string;
  percentLabel: string;
  percent: number;
  tone: 'green' | 'purple';
  sourceLabel: string;
  sourceAmount: string;
}

interface IncomeSlice {
  label: string;
  amount: string;
  percent: number;
  color: string;
}

interface SeriesPoint {
  day: number;    // día del mes (1-31)
  label: string;  // "1 May"
  value: number;  // total registrado ESE día (no acumulado)
}

interface RecentIncomeView {
  id: string;
  title: string;
  type: 'Fijo' | 'Variable';
  category: string;
  date: string;
  amount: number;
  method: string;
}

interface GroupSummary {
  label: string;
  amount: string;
  count: number;
  percent: number;
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
  selector: 'app-ingresos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './ingresos.component.html',
  styleUrl: './ingresos.component.css',
})
export class IngresosComponent implements OnInit {
  user: ReturnType<AuthService['getUser']>;

  navItems: NavItem[] = [
    { icon: 'grid', label: 'Vista General', route: '/dashboard' },
    { icon: 'in', label: 'Ingresos', active: true, route: '/ingresos' },
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

  readonly categoriesByType: Record<'Fijo' | 'Variable', string[]> = {
    Fijo: ['Salario', 'Renta', 'Pensión', 'Otro fijo'],
    Variable: ['Freelance', 'Bonos', 'Ventas', 'Reembolsos', 'Otro variable'],
  };
  readonly paymentMethods = ['Efectivo', 'Transferencia', 'Depósito', 'Tarjeta'];

  isLoading = false;
  recentIncomes: RecentIncomeView[] = [];

  totalIngresos = 'Q 0.00';
  totalTrend = '';
  ingresosRegistrados = 0;

  sourceCards: SourceCard[] = [
    { label: 'Ingresos fijos', amount: 'Q 0.00', percentLabel: '0% del total', percent: 0, tone: 'green', sourceLabel: '—', sourceAmount: 'Q 0.00' },
    { label: 'Ingresos variables', amount: 'Q 0.00', percentLabel: '0% del total', percent: 0, tone: 'purple', sourceLabel: '—', sourceAmount: 'Q 0.00' },
  ];

  distribution: IncomeSlice[] = [
    { label: 'Ingresos fijos', amount: 'Q 0.00', percent: 0, color: '#12B5A0' },
    { label: 'Ingresos variables', amount: 'Q 0.00', percent: 0, color: '#5B4FE8' },
  ];

  series: SeriesPoint[] = this.buildSeries([]);

  // Todos los ingresos tal como vienen del backend (sin filtrar), para poder
  // recalcular la gráfica cuando el usuario cambia de mes sin pedirlos de nuevo.
  private allIncomes: Income[] = [];

  // Mes que se está mostrando en "Comportamiento de ingresos", formato "YYYY-MM".
  selectedMonthKey: string = this.monthKey(new Date());

  private readonly chartWidth = 650; // ancho útil dentro del <g translate(50,0)>
  private readonly chartHeight = 200;

  // Meses para el selector: los que realmente tienen ingresos registrados,
  // más el mes actual aunque todavía esté vacío. Más reciente primero.
  // OJO: se recalcula solo al cargar datos (applySummary), NUNCA como getter:
  // si fuera un getter, Angular crea un array/objetos nuevos en cada detección
  // de cambios y el *ngFor destruye y recrea las <option>, haciendo que el
  // <select> "olvide" la opción marcada y vuelva a mostrar la primera.
  availableMonths: { value: string; label: string }[] = this.buildAvailableMonths([]);

  private buildAvailableMonths(incomes: Income[]): { value: string; label: string }[] {
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const keys = new Set<string>([this.monthKey(new Date())]);
    incomes.forEach((i) => keys.add(i.date.slice(0, 7)));

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

  // Solo un punto de cada ~2 días como "dot" visible, para que no se vea saturado.
  get markerPoints() {
    return this.chartPoints.points.filter((_, i) => i % 2 === 0);
  }

  // Etiquetas del eje Y (Q) de arriba hacia abajo, en 5 escalones.
  get yAxisLabels(): string[] {
    const max = this.chartPoints.maxValue;
    const steps = 4;
    const labels: string[] = [];
    for (let i = steps; i >= 0; i--) {
      labels.push(this.formatAxisQ((max / steps) * i));
    }
    return labels;
  }

  // Etiquetas del eje X (días): solo mostramos ~7, no los 30/31 días.
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

  get totalDistribucion(): string {
    return this.totalIngresos;
  }

  get currentCategories(): string[] {
    const type = (this.incomeForm.value.type as 'Fijo' | 'Variable') ?? 'Fijo';
    return this.categoriesByType[type];
  }

  // ---------- Modal / formulario ----------
  showModal = false;
  incomeForm: FormGroup;
  isSaving = false;
  // Si tiene valor, el modal está editando ese ingreso en vez de crear uno nuevo.
  editingIncomeId: string | null = null;

  // ---------- Panel de "Acciones rápidas" tipo acordeón ----------
activePanel: 'ingresos' | 'categorias' | 'fuentes' | null = null;
categorySummaries: GroupSummary[] = [];
paymentMethodSummaries: GroupSummary[] = [];

togglePanel(panel: 'ingresos' | 'categorias' | 'fuentes'): void {
  this.activePanel = this.activePanel === panel ? null : panel;
}

// "Ver todos" de la tabla de Ingresos recientes: abre el listado completo
// dentro de Acciones rápidas y baja la vista hasta ahí.
verTodosIngresos(): void {
  this.activePanel = 'ingresos';
  setTimeout(() => {
    document.getElementById('verTodosIngresos')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private incomeService: IncomeService,
    private router: Router,
  ) {
    this.user = this.authService.getUser();
    this.incomeForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      type: ['Fijo', [Validators.required]],
      category: ['Salario', [Validators.required]],
      amount: [null, [Validators.required, Validators.min(0.01)]],
      method: ['Transferencia', [Validators.required]],
      date: [this.todayIso(), [Validators.required, noFutureDateValidator()]],
    });

    this.incomeForm.get('type')?.valueChanges.subscribe((type: 'Fijo' | 'Variable') => {
      this.incomeForm.get('category')?.setValue(this.categoriesByType[type][0]);
    });
  }

  ngOnInit(): void {
    this.loadIncomes();
  }

  get f() {
    return this.incomeForm.controls;
  }

  private todayIso(): string {
    return localTodayIso();
  }

  // Usado en el template para poner max="..." en el <input type="date">,
  // así el selector de fecha del navegador ni siquiera deja elegir un día futuro.
  get maxDate(): string {
    return this.todayIso();
  }

  loadIncomes(): void {
    this.isLoading = true;
    this.incomeService.getSummary().subscribe({
      next: (res) => {
        this.applySummary(res.data.incomes, res.data.totalFixed, res.data.totalVariable);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error cargando ingresos', err);
        this.isLoading = false;
      },
    });
  }

  private applySummary(incomes: Income[], totalFixed: number, totalVariable: number): void {
    this.allIncomes = incomes;
    this.recentIncomes = incomes.map((i) => ({
      id: i.id,
      title: i.title,
      type: i.type,
      category: i.category,
      date: this.formatDate(i.date),
      amount: i.amount,
      method: i.method,
    }));

    this.ingresosRegistrados = incomes.length;
    const total = totalFixed + totalVariable;
    this.totalIngresos = this.formatQ(total);

    const percentFixed = total > 0 ? Math.round((totalFixed / total) * 100) : 0;
    const percentVariable = total > 0 ? 100 - percentFixed : 0;

    const topSource = (items: Income[]) => {
      if (items.length === 0) return { label: '—', amount: 0 };
      const byCategory = new Map<string, number>();
      items.forEach((i) => byCategory.set(i.category, (byCategory.get(i.category) ?? 0) + i.amount));
      const [label, amount] = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];
      return { label, amount };
    };

    const topFixed = topSource(incomes.filter((i) => i.type === 'Fijo'));
    const topVariable = topSource(incomes.filter((i) => i.type === 'Variable'));

    this.sourceCards = [
      { label: 'Ingresos fijos', amount: this.formatQ(totalFixed), percentLabel: `${percentFixed}% del total`, percent: percentFixed, tone: 'green', sourceLabel: topFixed.label, sourceAmount: this.formatQ(topFixed.amount) },
      { label: 'Ingresos variables', amount: this.formatQ(totalVariable), percentLabel: `${percentVariable}% del total`, percent: percentVariable, tone: 'purple', sourceLabel: topVariable.label, sourceAmount: this.formatQ(topVariable.amount) },
    ];

    this.distribution = [
      { label: 'Ingresos fijos', amount: this.formatQ(totalFixed), percent: percentFixed, color: '#12B5A0' },
      { label: 'Ingresos variables', amount: this.formatQ(totalVariable), percent: percentVariable, color: '#5B4FE8' },
    ];

    this.categorySummaries = this.buildGroupSummary(incomes, (i) => i.category);
    this.paymentMethodSummaries = this.buildGroupSummary(incomes, (i) => i.method);

    this.availableMonths = this.buildAvailableMonths(incomes);
    this.series = this.buildSeries(incomes, this.selectedMonthKey);
  }

  // Un punto por cada día del mes indicado (por defecto, el actual), con el
  // total registrado ese día (no acumulado) -> la línea sube y baja como en
  // el diseño de referencia.
  private buildSeries(incomes: Income[], monthKey?: string): SeriesPoint[] {
    const [year, month] = (monthKey ?? this.monthKey(new Date())).split('-').map(Number); // month: 1-indexado
    const daysInMonth = new Date(year, month, 0).getDate();
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    const byDay = new Array(daysInMonth + 1).fill(0);
    incomes.forEach((inc) => {
      const [y, m, d] = inc.date.split('-').map(Number);
      if (y === year && m === month && d >= 1 && d <= daysInMonth) {
        byDay[d] += inc.amount;
      }
    });

    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      return { day, label: `${day} ${meses[month - 1]}`, value: byDay[day] };
    });
  }

  // "YYYY-MM" para una fecha dada; se usa como valor del selector de mes.
  private monthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  // El usuario eligió otro mes en "Comportamiento de ingresos": recalculamos
  // la serie con los mismos ingresos ya cargados, sin volver a pedir al backend.
  onMonthChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedMonthKey = value;
    this.series = this.buildSeries(this.allIncomes, value);
  }

  // Convierte una lista de puntos en una curva suave (Catmull-Rom -> Bézier),
  // pero recortando los puntos de control para que la curva NUNCA se dispare
  // por encima/por debajo de los dos puntos que está conectando. Sin este
 // recorte, un valor aislado rodeado de ceros genera un pico irreal.
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

  // Redondea el máximo hacia un número "bonito" para el eje Y (100, 200, 500, 1000...)
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

  // Versión corta (sin decimales) para el eje Y del gráfico: el espacio es
// limitado y los centavos no aportan nada en esa escala.
private formatAxisQ(value: number): string {
  return 'Q ' + Math.round(value).toLocaleString('es-GT');
}

  private buildGroupSummary(incomes: Income[], keyFn: (i: Income) => string): GroupSummary[] {
  const total = incomes.reduce((sum, i) => sum + i.amount, 0);
  const map = new Map<string, { amount: number; count: number }>();

  incomes.forEach((i) => {
    const key = keyFn(i);
    const entry = map.get(key) ?? { amount: 0, count: 0 };
    entry.amount += i.amount;
    entry.count += 1;
    map.set(key, entry);
  });

  return [...map.entries()]
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([label, v]) => ({
      label,
      amount: this.formatQ(v.amount),
      count: v.count,
      percent: total > 0 ? Math.round((v.amount / total) * 100) : 0,
    }));
}

  openModal(): void {
    this.editingIncomeId = null;
    this.incomeForm.reset({
      title: '',
      type: 'Fijo',
      category: 'Salario',
      amount: null,
      method: 'Transferencia',
      date: this.todayIso(),
    });
    this.showModal = true;
  }

  // Abre el mismo modal pero precargado con los datos del ingreso, y deja
  // guardado el id para que submitIncome() haga un update en vez de un create.
  openEditModal(incomeView: RecentIncomeView): void {
    const income = this.allIncomes.find((i) => i.id === incomeView.id);
    if (!income) return;

    this.editingIncomeId = income.id;
    this.incomeForm.reset({
      title: income.title,
      type: income.type,
      category: income.category,
      amount: income.amount,
      method: income.method,
      date: income.date,
    });
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingIncomeId = null;
  }

  submitIncome(): void {
    if (this.incomeForm.invalid) {
      this.incomeForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    const { title, type, category, amount, method, date } = this.incomeForm.value;
    const payload = { title, type, category, amount: Number(amount), method, date };

    const request$ = this.editingIncomeId
      ? this.incomeService.update(this.editingIncomeId, payload)
      : this.incomeService.create(payload);

    request$.subscribe({
      next: () => {
        this.isSaving = false;
        this.showModal = false;
        this.editingIncomeId = null;
        this.loadIncomes();
      },
      error: (err) => {
        console.error('Error guardando ingreso', err);
        this.isSaving = false;
      },
    });
  }

  // Pide confirmación y elimina el ingreso; si el usuario cancela, no hace nada.
  deleteIncome(incomeView: RecentIncomeView): void {
    const confirmado = confirm(`¿Eliminar el ingreso "${incomeView.title}"? Esta acción no se puede deshacer.`);
    if (!confirmado) return;

    this.incomeService.delete(incomeView.id).subscribe({
      next: () => this.loadIncomes(),
      error: (err) => console.error('Error eliminando ingreso', err),
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}