import express, { Application } from 'express';
import cors from 'cors';
import authRoutes from './modules/auth/routes/auth.routes';
import incomeRoutes from './modules/income/routes/income.routes';
import expenseRoutes from './modules/expense/routes/expense.routes';
import expenseGoalRoutes from './modules/expense/routes/expense-goal.routes';
import smallExpenseRoutes from './modules/small-expense/routes/small-expense.routes';
import smallExpenseGoalRoutes from './modules/small-expense/routes/small-expense-goal.routes';
import budgetRoutes from './modules/budget/routes/budget.routes';
import notificationRoutes from './modules/notification/routes/notification.routes';
import accountRoutes from './modules/account/routes/account.routes';

/**
 * Configuración de la aplicación Express: middlewares globales y montaje
 * de rutas de cada módulo. Separado de server.ts para poder testear "app"
 * sin necesidad de levantar un puerto real (supertest, etc).
 */
const app: Application = express();

app.use(cors());
app.use(express.json());

// Healthcheck
app.get('/api/health', (_req, res) => {
  res.status(200).json({ success: true, message: 'API Control de Gastos funcionando' });
});

// Rutas por módulo
app.use('/api/auth', authRoutes);
app.use('/api/incomes', incomeRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/expense-goals', expenseGoalRoutes);
app.use('/api/small-expenses', smallExpenseRoutes); // ← nuevo
app.use('/api/small-expense-goals', smallExpenseGoalRoutes); // ← nuevo
app.use('/api/budgets', budgetRoutes);
app.use('/api/notifications', notificationRoutes); // ← nuevo
app.use('/api/account', accountRoutes); // ← nuevo

export default app;