/**
 * Entidad "SmallExpense". Representa una fila de la tabla "small_expenses"
 * (gastos hormiga: cafés, snacks, bebidas, etc.).
 * "expenseId" enlaza con el Egreso reflejo creado automáticamente en la
 * tabla "expenses" bajo la categoría "Pequeños consumos".
 */
export type SmallExpenseCategory = 'Café' | 'Snacks' | 'Bebidas' | 'Panadería' | 'Otros';

export interface SmallExpense {
  id: string;
  userId: string;
  expenseId: string;
  description: string;
  category: SmallExpenseCategory;
  amount: number;
  method: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
}