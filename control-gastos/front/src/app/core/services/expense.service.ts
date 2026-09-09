import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateExpensePayload, Expense, ExpenseSummary, UpdateExpensePayload } from '../models/expense.model';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/**
 * Habla con /api/expenses. El interceptor ya adjunta el Bearer token,
 * así que aquí no hace falta preocuparse por eso.
 */
@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private readonly apiUrl = `${environment.apiUrl}/expenses`;

  constructor(private http: HttpClient) {}

  getSummary(): Observable<ApiResponse<ExpenseSummary>> {
    return this.http.get<ApiResponse<ExpenseSummary>>(this.apiUrl);
  }

  create(payload: CreateExpensePayload): Observable<ApiResponse<Expense>> {
    return this.http.post<ApiResponse<Expense>>(this.apiUrl, payload);
  }

  update(id: string, payload: UpdateExpensePayload): Observable<ApiResponse<Expense>> {
    return this.http.put<ApiResponse<Expense>>(`${this.apiUrl}/${id}`, payload);
  }

  delete(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.apiUrl}/${id}`);
  }
}