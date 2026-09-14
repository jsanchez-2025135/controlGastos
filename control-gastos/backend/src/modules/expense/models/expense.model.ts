/**
 * Entidad "Expense". Representa una fila de la tabla "expenses".
 */
export type ExpenseCategory = 'Alimentación' | 'Transporte' | 'Vivienda' | 'Servicios' | 'Otros' | 'Pequeños consumos';

export interface Expense {
  id: string;
  userId: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  method: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
}