import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ExpenseGoal, UpdateExpenseGoalPayload } from '../models/expense-goal.model';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/**
 * Habla con /api/expense-goals. El interceptor ya adjunta el Bearer token,
 * así que aquí no hace falta preocuparse por eso.
 */
@Injectable({ providedIn: 'root' })
export class ExpenseGoalService {
  private readonly apiUrl = `${environment.apiUrl}/expense-goals`;

  constructor(private http: HttpClient) {}

  get(): Observable<ApiResponse<ExpenseGoal>> {
    return this.http.get<ApiResponse<ExpenseGoal>>(this.apiUrl);
  }

  update(payload: UpdateExpenseGoalPayload): Observable<ApiResponse<ExpenseGoal>> {
    return this.http.put<ApiResponse<ExpenseGoal>>(this.apiUrl, payload);
  }
}