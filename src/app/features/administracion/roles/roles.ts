import { Component, signal, inject } from '@angular/core';
import { Rol, RolesService } from '../../../core/services/roles.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-roles',
  standalone: true,
  templateUrl: './roles.html',
  styleUrl: './roles.scss',
})
export class Roles {
  protected readonly roles = signal<Rol[]>([]);
  protected readonly cargando = signal(true);

  constructor() {
    const rolesService = inject(RolesService);
    const toastService = inject(ToastService);

    rolesService.listRoles().subscribe({
      next: (roles) => {
        this.roles.set(roles);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        toastService.error('No se pudieron cargar los roles.');
      },
    });
  }
}
