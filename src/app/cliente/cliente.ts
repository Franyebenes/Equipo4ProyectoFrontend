import { Component, computed, inject } from '@angular/core';

import { AuthService } from '../core/auth.service';

// Página provisional a la que llega un cliente (Estándar o Premium) al iniciar sesión.
@Component({
  selector: 'app-cliente',
  templateUrl: './cliente.html',
  styleUrl: './cliente.css',
})
export class Cliente {
  private readonly auth = inject(AuthService);

  readonly premium = computed(() => this.auth.usuario()?.rol === 'PREMIUM');
}
