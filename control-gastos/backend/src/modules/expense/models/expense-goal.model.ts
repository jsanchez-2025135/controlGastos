/**
 * Entidad "ExpenseGoal". Representa la meta mensual de egresos de un usuario.
 * Es 1 a 1 con "users": cada usuario tiene como máximo una meta activa.
 */
export interface ExpenseGoal {
  userId: string;
  amount: number;
  updatedAt: string;
}