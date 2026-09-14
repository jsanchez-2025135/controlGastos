import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AccountProfile, ChangePasswordPayload, UpdateNamePayload } from '../models/account.model';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/**
 * Habla con /api/account. El interceptor ya adjunta el Bearer token,
 * así que aquí no hace falta preocuparse por eso.
 */
@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly apiUrl = `${environment.apiUrl}/account`;

  constructor(private http: HttpClient) {}

  getProfile(): Observable<ApiResponse<AccountProfile>> {
    return this.http.get<ApiResponse<AccountProfile>>(this.apiUrl);
  }

  updateName(payload: UpdateNamePayload): Observable<ApiResponse<AccountProfile>> {
    return this.http.put<ApiResponse<AccountProfile>>(this.apiUrl, payload);
  }

  changePassword(payload: ChangePasswordPayload): Observable<ApiResponse<null>> {
    return this.http.put<ApiResponse<null>>(`${this.apiUrl}/password`, payload);
  }
}