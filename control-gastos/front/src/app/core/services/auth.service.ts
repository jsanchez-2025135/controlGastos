import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthUser } from '../models/user.model';
import { LoginResponse } from '../models/login-response.model';
import { SessionExpiredService } from './session-expired.service';
import { getMsUntilExpiration } from '../utils/jwt.util';

const TOKEN_KEY = 'cg_token';
const USER_KEY = 'cg_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;

  constructor(private http: HttpClient, private sessionExpiredService: SessionExpiredService) {
    const existingToken = this.getToken();
    if (existingToken) {
      this.scheduleExpirationFor(existingToken);
    }
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, { email, password }).pipe(
      tap((response) => {
        this.setSession(response.data.token, response.data.user);
      })
      
    );
    
  }

  loginWithGoogle(idToken: string): Observable<LoginResponse> {
  return this.http.post<LoginResponse>(`${this.apiUrl}/google`, { idToken }).pipe(
    tap((response) => {
      this.setSession(response.data.token, response.data.user);
    })
  );
}

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.sessionExpiredService.clear();
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  getUser(): AuthUser | null {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  hasRole(role: AuthUser['role']): boolean {
    return this.getUser()?.role === role;
  }

  private setSession(token: string, user: AuthUser): void {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.scheduleExpirationFor(token);
  }

  private scheduleExpirationFor(token: string): void {
    const msRemaining = getMsUntilExpiration(token);
    if (msRemaining === null) return;
    this.sessionExpiredService.scheduleExpiration(msRemaining);
  }
}