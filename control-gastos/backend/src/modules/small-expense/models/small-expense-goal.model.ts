/**
 * Entidad "SmallExpenseGoal". Representa la meta mensual de pequeños
 * consumos de un usuario. Es 1 a 1 con "users".
 */
export interface SmallExpenseGoal {
  userId: string;
  amount: number;
  updatedAt: string;
}