import { Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { ToastService } from '../../core/services/toast.service';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  protected readonly showPassword = signal(false);
  protected readonly loading = signal(false);
  protected readonly shake = signal(false);
  protected readonly authError = signal(false);
  protected readonly authMessage = signal('');
  private shakeTimer?: ReturnType<typeof setTimeout>;
  protected readonly success = signal(false);
  protected readonly temaService = inject(ThemeService);
  protected readonly etiquetaTema = computed(() =>
    this.temaService.tema() === 'oscuro' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro',
  );

  protected readonly form;

  constructor() {
    const route = inject(ActivatedRoute);

    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.pattern(EMAIL_REGEX)]],
      password: ['', [Validators.required]],
    });

    const motivo = route.snapshot.queryParamMap.get('motivo');
    if (motivo === 'inactividad') {
      this.toastService.info('Tu sesión se cerró por inactividad. Vuelve a iniciar sesión.');
    } else if (motivo === 'sesion') {
      this.toastService.info('Tu sesión expiró o ya no es válida. Vuelve a iniciar sesión.');
    }
  }

  protected invalid(name: 'email' | 'password'): boolean {
    const c = this.form.controls[name];
    return (c.invalid && (c.touched || c.dirty)) || this.authError();
  }

  protected clearAuthError(): void {
    if (this.authError()) {
      this.authError.set(false);
      this.authMessage.set('');
    }
  }

  togglePassword(): void {
    this.showPassword.update((value) => !value);
  }

  submit(): void {
    if (this.form.invalid || this.loading() || this.success()) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password } = this.form.getRawValue();
    this.loading.set(true);

    this.authService.login(email!.trim(), password!).subscribe({
      next: () => {
        this.loading.set(false);
        this.authError.set(false);
        this.success.set(true);
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        setTimeout(() => this.router.navigateByUrl('/home'), reduce ? 150 : 550);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.authError.set(true);
        const mensaje = err.error?.message;
        const texto =
          typeof mensaje === 'string'
            ? mensaje
            : Array.isArray(mensaje)
              ? mensaje.join(' ')
              : 'No se pudo iniciar sesión. Intenta de nuevo más tarde.';
        // Reinicia la animación en cada intento fallido.
        clearTimeout(this.shakeTimer);
        this.shake.set(false);
        this.authMessage.set('');
        setTimeout(() => {
          this.shake.set(true);
          this.authMessage.set(texto);
          this.shakeTimer = setTimeout(() => this.shake.set(false), 450);
        }, 30);
      },
    });
  }
}
