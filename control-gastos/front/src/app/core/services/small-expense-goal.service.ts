import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SmallExpenseGoal, UpdateSmallExpenseGoalPayload } from '../models/small-expense-goal.model';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/**
 * Habla con /api/small-expense-goals. El interceptor ya adjunta el Bearer token,
 * así que aquí no hace falta preocuparse por eso.
 */
@Injectable({ providedIn: 'root' })
export class SmallExpenseGoalService {
  private readonly apiUrl = `${environment.apiUrl}/small-expense-goals`;

  constructor(private http: HttpClient) {}

  get(): Observable<ApiResponse<SmallExpenseGoal>> {
    return this.http.get<ApiResponse<SmallExpenseGoal>>(this.apiUrl);
  }

  update(payload: UpdateSmallExpenseGoalPayload): Observable<ApiResponse<SmallExpenseGoal>> {
    return this.http.put<ApiResponse<SmallExpenseGoal>>(this.apiUrl, payload);
  }
}