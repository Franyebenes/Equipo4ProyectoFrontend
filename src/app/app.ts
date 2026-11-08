import { Component, computed, effect, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from './core/auth.service';
import { CarritoService } from './cliente/carrito.service';
import { VentanaInfo } from './compartido/ventana-info/ventana-info';
import { Ventana, VentanaInfoService } from './compartido/ventana-info/ventana-info.service';
import { imagenDeAvatar } from './perfil/perfil.service';

// Cáscara de la app: cabecera compartida (con el usuario y el cierre de sesión) y salida de rutas.
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgTemplateOutlet, VentanaInfo],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly carrito = inject(CarritoService);

  menuAbierto = signal(false);
  // Compartida con las páginas: el pie de la Home también abre la ventana de Ayuda.
  ventanaAbierta = inject(VentanaInfoService).abierta;

  // El administrador solo trabaja en su panel: sin portada ni enlaces informativos en la cabecera.
  readonly esAdmin = computed(() => this.auth.usuario()?.rol === 'ADMIN');
  readonly esVendedor = computed(() => this.auth.usuario()?.rol === 'VENDEDOR');
  // El cliente (Estándar o Premium) solo ve su página: sin portada ni enlaces informativos en la cabecera.
  readonly esCliente = computed(() => {
    const rol = this.auth.usuario()?.rol;
    return rol === 'CLIENTE' || rol === 'PREMIUM';
  });

  // Al entrar un cliente se carga su carrito para mostrar el número de artículos en la cabecera
  private readonly cargarContadorCarrito = effect(() => {
    if (this.esCliente()) {
      this.carrito.obtener().subscribe({ error: () => this.carrito.numeroArticulos.set(0) });
    } else {
      this.carrito.numeroArticulos.set(0);
    }
  });

  // La portada es solo para visitantes: con sesión, el logo lleva a la página de cada rol.
  readonly rutaLogo = computed(() => {
    if (this.esAdmin()) {
      return '/admin/usuarios';
    }
    if (this.esVendedor()) {
      return '/vendedor/productos';
    }
    return this.esCliente() ? '/cliente' : '/';
  });

  // Imagen del avatar del usuario; si no eligió uno del catálogo, la imagen por defecto.
  readonly imagenAvatar = computed(() => {
    const usuario = this.auth.usuario();
    return imagenDeAvatar(usuario?.avatar, usuario?.rol);
  });

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

  abrirVentana(ventana: Ventana): void {
    this.cerrarMenu();
    this.ventanaAbierta.set(ventana);
  }

  cerrarVentana(): void {
    this.ventanaAbierta.set(null);
  }
}