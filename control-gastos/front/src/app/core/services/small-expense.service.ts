import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateSmallExpensePayload, SmallExpense, SmallExpenseSummary, UpdateSmallExpensePayload } from '../models/small-expense.model';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/**
 * Habla con /api/small-expenses. El interceptor ya adjunta el Bearer token,
 * así que aquí no hace falta preocuparse por eso.
 */
@Injectable({ providedIn: 'root' })
export class SmallExpenseService {
  private readonly apiUrl = `${environment.apiUrl}/small-expenses`;

  constructor(private http: HttpClient) {}

  getSummary(): Observable<ApiResponse<SmallExpenseSummary>> {
    return this.http.get<ApiResponse<SmallExpenseSummary>>(this.apiUrl);
  }

  create(payload: CreateSmallExpensePayload): Observable<ApiResponse<SmallExpense>> {
    return this.http.post<ApiResponse<SmallExpense>>(this.apiUrl, payload);
  }

  update(id: string, payload: UpdateSmallExpensePayload): Observable<ApiResponse<SmallExpense>> {
    return this.http.put<ApiResponse<SmallExpense>>(`${this.apiUrl}/${id}`, payload);
  }

  delete(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.apiUrl}/${id}`);
  }
}