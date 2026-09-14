import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, tap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { SessionExpiredService } from '../services/session-expired.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const sessionExpiredService = inject(SessionExpiredService);
  const token = authService.getToken();

  const cloned = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(cloned).pipe(
    tap((event) => {
      if (event instanceof HttpResponse) {
        const newToken = event.headers.get('X-New-Token');
        if (newToken) {
          authService.refreshToken(newToken);
        }
      }
    }),
    catchError((error) => {
      if (error?.status === 401 && token) {
        sessionExpiredService.triggerExpired();
      }
      return throwError(() => error);
    })
  );
};