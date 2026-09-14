import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BudgetCategory, BudgetSummary } from '../models/budget.model';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/**
 * Habla con /api/budgets. El interceptor ya adjunta el Bearer token,
 * así que aquí no hace falta preocuparse por eso.
 */
@Injectable({ providedIn: 'root' })
export class BudgetService {
  private readonly apiUrl = `${environment.apiUrl}/budgets`;

  constructor(private http: HttpClient) {}

  getSummary(): Observable<ApiResponse<BudgetSummary>> {
    return this.http.get<ApiResponse<BudgetSummary>>(this.apiUrl);
  }

  // encodeURIComponent es importante aquí: la categoría tiene tildes y "ñ"
  // (ej. "Alimentación") y va en la URL, no en el body.
  setBudget(category: BudgetCategory, monthlyAmount: number): Observable<ApiResponse<BudgetSummary>> {
    return this.http.put<ApiResponse<BudgetSummary>>(`${this.apiUrl}/${encodeURIComponent(category)}`, { monthlyAmount });
  }
}