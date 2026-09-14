import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AccountService } from '../../core/services/account.service';
import { AccountProfile } from '../../core/models/account.model';

interface NavItem {
  icon: 'grid' | 'in' | 'out' | 'coffee' | 'list' | 'chart-pie' | 'chart-bar' | 'bell' | 'user' | 'gear';
  label: string;
  active?: boolean;
  route?: string;
}

// Valida que "confirmNewPassword" sea igual a "newPassword" dentro del mismo FormGroup.
function passwordsMatchValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const newPassword = group.get('newPassword')?.value;
    const confirm = group.get('confirmNewPassword')?.value;
    if (!newPassword || !confirm) return null;
    return newPassword === confirm ? null : { passwordsMismatch: true };
  };
}

@Component({
  selector: 'app-cuenta',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './cuenta.component.html',
  styleUrl: './cuenta.component.css',
})
export class CuentaComponent implements OnInit {
  user: ReturnType<AuthService['getUser']>;

  navItems: NavItem[] = [
    { icon: 'grid', label: 'Vista General', route: '/dashboard' },
    { icon: 'in', label: 'Ingresos', route: '/ingresos' },
    { icon: 'out', label: 'Egresos', route: '/egresos' },
    { icon: 'coffee', label: 'Pequeños Consumos', route: '/pequenos-consumos' },
  ];
  navItemsSecondary: NavItem[] = [
    { icon: 'list', label: 'Transacciones', route: '/transacciones' },
    { icon: 'chart-pie', label: 'Presupuestos', route: '/presupuestos' },
  ];
  navItemsTertiary: NavItem[] = [
    { icon: 'chart-bar', label: 'Reportes', route: '/reportes' },
    { icon: 'bell', label: 'Notificaciones', route: '/notificaciones' },
  ];
  navItemsAccount: NavItem[] = [
    { icon: 'user', label: 'Cuenta', active: true, route: '/cuenta' },
    { icon: 'gear', label: 'Ajustes', route: '/ajustes' },
  ];

  isLoading = false;
  profile: AccountProfile | null = null;
  memberSinceLabel = '';

  // ---------- Edición de nombre ----------
  editingName = false;
  nameForm: FormGroup;
  isSavingName = false;
  nameError: string | null = null;

  // ---------- Cambio de contraseña ----------
  passwordForm: FormGroup;
  isSavingPassword = false;
  passwordError: string | null = null;
  passwordSuccess = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private accountService: AccountService,
    private router: Router,
  ) {
    this.user = this.authService.getUser();

    this.nameForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
    });

    this.passwordForm = this.fb.group(
      {
        currentPassword: ['', [Validators.required]],
        newPassword: ['', [Validators.required, Validators.minLength(8)]],
        confirmNewPassword: ['', [Validators.required]],
      },
      { validators: passwordsMatchValidator() },
    );
  }

  ngOnInit(): void {
    this.loadProfile();
  }

  
  get nf() {
    return this.nameForm.controls;
  }

  get pf() {
    return this.passwordForm.controls;
  }

  loadProfile(): void {
    this.isLoading = true;
    this.accountService.getProfile().subscribe({
      next: (res) => {
        this.applyProfile(res.data);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error cargando el perfil', err);
        this.isLoading = false;
      },
    });
  }

  private applyProfile(profile: AccountProfile): void {
    this.profile = profile;
    this.memberSinceLabel = profile.user.createdAt ? this.formatMonthYear(profile.user.createdAt) : '—';
  }

  private formatMonthYear(iso: string): string {
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const d = new Date(iso);
    return `${meses[d.getMonth()]} ${d.getFullYear()}`;
  }

  get avatarInitial(): string {
    return (this.profile?.user.name || 'U').charAt(0).toUpperCase();
  }

  // ---------- Editar nombre ----------
  startEditName(): void {
    if (!this.profile) return;
    this.nameError = null;
    this.nameForm.reset({ name: this.profile.user.name });
    this.editingName = true;
  }

  cancelEditName(): void {
    this.editingName = false;
    this.nameError = null;
  }

  submitName(): void {
    if (this.nameForm.invalid) {
      this.nameForm.markAllAsTouched();
      return;
    }

    this.isSavingName = true;
    this.nameError = null;

    this.accountService.updateName({ name: this.nameForm.value.name }).subscribe({
      next: (res) => {
        this.applyProfile(res.data);
        // Refresca la copia local (localStorage) para que el sidebar de
        // TODAS las pantallas muestre el nombre nuevo sin recargar sesión.
        this.authService.updateStoredUser(res.data.user);
        this.user = res.data.user;
        this.isSavingName = false;
        this.editingName = false;
      },
      error: (err) => {
        console.error('Error actualizando el nombre', err);
        this.isSavingName = false;
        this.nameError = err?.error?.message || 'No se pudo actualizar el nombre. Intenta de nuevo.';
      },
    });
  }

  // ---------- Cambiar contraseña ----------
  submitPassword(): void {
    this.passwordSuccess = false;
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.isSavingPassword = true;
    this.passwordError = null;
    const { currentPassword, newPassword } = this.passwordForm.value;

    this.accountService.changePassword({ currentPassword, newPassword }).subscribe({
      next: () => {
        this.isSavingPassword = false;
        this.passwordSuccess = true;
        this.passwordForm.reset();
      },
      error: (err) => {
        console.error('Error cambiando la contraseña', err);
        this.isSavingPassword = false;
        this.passwordError = err?.error?.message || 'No se pudo cambiar la contraseña. Intenta de nuevo.';
      },
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}