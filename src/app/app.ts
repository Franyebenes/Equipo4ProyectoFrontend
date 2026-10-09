import { Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from './core/auth.service';

// Solo los avatares del catálogo (avatar-01, avatar-02...) tienen imagen en public/avatares.
const AVATAR_DEL_CATALOGO = /^avatar-\d+$/;

// Cáscara de la app: cabecera compartida (con el usuario y el cierre de sesión) y salida de rutas.
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgTemplateOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  menuAbierto = signal(false);

  // El administrador solo trabaja en su panel: sin portada ni enlaces informativos en la cabecera.
  readonly esAdmin = computed(() => this.auth.usuario()?.rol === 'ADMIN');

  // Imagen del avatar del usuario, o null si no tiene uno del catálogo (se muestra su inicial).
  // Los vendedores tienen su propia carpeta de avatares; los demás usan la de clientes, como el alta de admin.
  readonly imagenAvatar = computed(() => {
    const usuario = this.auth.usuario();
    if (!usuario?.avatar || !AVATAR_DEL_CATALOGO.test(usuario.avatar)) {
      return null;
    }
    const carpeta = usuario.rol === 'VENDEDOR' ? 'vendedores' : 'clientes';
    return `/avatares/${carpeta}/${usuario.avatar}.png`;
  });

  readonly inicial = computed(() => (this.auth.usuario()?.nombre?.[0] ?? '?').toUpperCase());

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
