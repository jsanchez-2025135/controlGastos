import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NotificationSummary } from '../models/notification.model';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/**
 * Habla con /api/notifications. El interceptor ya adjunta el Bearer token,
 * así que aquí no hace falta preocuparse por eso.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly apiUrl = `${environment.apiUrl}/notifications`;

  constructor(private http: HttpClient) {}

  getSummary(): Observable<ApiResponse<NotificationSummary>> {
    return this.http.get<ApiResponse<NotificationSummary>>(this.apiUrl);
  }

  markAsRead(id: string): Observable<ApiResponse<null>> {
    return this.http.patch<ApiResponse<null>>(`${this.apiUrl}/${id}/read`, {});
  }

  markAllAsRead(): Observable<ApiResponse<null>> {
    return this.http.patch<ApiResponse<null>>(`${this.apiUrl}/read-all`, {});
  }

  delete(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.apiUrl}/${id}`);
  }
}