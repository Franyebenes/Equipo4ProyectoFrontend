import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from './core/auth.service';

// Cáscara de la app: cabecera compartida (con el usuario y el cierre de sesión) y salida de rutas.
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  menuAbierto = signal(false);

  async cerrarSesion(): Promise<void> {
    this.cerrarMenu();
    try {
      await this.auth.logout();
    } catch {
      // El estado local ya se ha descartado aunque el servidor no haya respondido.
    }
    await this.router.navigateByUrl('/');
  }

  alternarMenu(): void {
    this.menuAbierto.update((abierto) => !abierto);
  }

  cerrarMenu(): void {
    this.menuAbierto.set(false);
  }
}
