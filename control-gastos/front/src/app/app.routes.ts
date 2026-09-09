import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { IngresosComponent } from './features/ingresos/ingresos.component';
import { EgresosComponent } from './features/egresos/egresos.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },

  // Ruta protegida: cualquier usuario autenticado (Admin o User)
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'ingresos', component: IngresosComponent, canActivate: [authGuard] },
  { path: 'egresos', component: EgresosComponent, canActivate: [authGuard] },
  // Ejemplo de ruta protegida SOLO para Admin (lista para cuando exista la vista)
  // { path: 'admin', component: AdminComponent, canActivate: [authGuard], data: { role: 'admin' } },

  { path: '**', redirectTo: 'login' },
];