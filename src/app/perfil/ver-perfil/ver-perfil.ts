import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { mensajeDeError } from '../../core/mensaje-error';
import { DatosPerfil, PerfilService, imagenDeAvatar } from '../perfil.service';
import { AuthService } from '../../core/auth.service';
import { Direccion, DireccionService, lineaCalle } from '../../direcciones/direccion.service';
import { DialogoConfirmacion } from '../../admin/dialogo-confirmacion/dialogo-confirmacion';

/** Página "Mi perfil". Muestra los datos que corresponden al rol del usuario. */
@Component({
  selector: 'app-ver-perfil',
  imports: [RouterLink, DatePipe, DialogoConfirmacion],
  templateUrl: './ver-perfil.html',
  styleUrl: './ver-perfil.css',
})
export class VerPerfil {
  protected readonly perfilService = inject(PerfilService);

  protected readonly perfil = signal<DatosPerfil | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly esCliente = computed(() => {
    const rol = this.perfil()?.rol;
    return rol === 'CLIENTE' || rol === 'PREMIUM';
  });
  protected readonly imagen = computed(() => imagenDeAvatar(this.perfil()?.avatar, this.perfil()?.rol));
  protected readonly tipoCuenta = computed(() => {
    switch (this.perfil()?.rol) {
      case 'PREMIUM':
        return 'Cliente Premium';
      case 'CLIENTE':
        return 'Cliente Estándar';
      case 'VENDEDOR':
        return 'Vendedor';
      case 'ADMIN':
        return 'Administrador';
      default:
        return '';
    }
  });

  constructor() {
    this.perfilService.obtener().subscribe({
      next: (perfil) => {
        this.perfil.set(perfil);
        if (this.esCliente()) {
          this.cargarDirecciones();
        }
      },
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  private readonly direccionService = inject(DireccionService);

  protected readonly direcciones = signal<Direccion[]>([]);
  protected readonly cargandoDirecciones = signal(true);
  protected readonly errorDirecciones = signal<string | null>(null);
  /** Id de la dirección cuyo borrado se está confirmando */
  protected readonly confirmandoBorrado = signal<string | null>(null);
  protected readonly lineaCalle = lineaCalle;

  private cargarDirecciones(): void {
    this.direccionService.listar().subscribe({
      next: (lista) => {
        this.direcciones.set(lista);
        this.cargandoDirecciones.set(false);
      },
      error: (e) => {
        this.errorDirecciones.set(mensajeDeError(e));
        this.cargandoDirecciones.set(false);
      },
    });
  }

  protected eliminarDireccion(direccion: Direccion): void {
    this.confirmandoBorrado.set(null);
    this.errorDirecciones.set(null);
    this.direccionService.eliminar(direccion.id).subscribe({
      next: () => this.cargarDirecciones(),
      // Un 409 si la dirección está en un pedido en curso
      error: (e) => this.errorDirecciones.set(mensajeDeError(e)),
    });
  }

  private readonly auth = inject(AuthService);

  protected readonly mensajeExito = signal<string | null>(null);
  protected readonly confirmandoBaja = signal(false);
  protected readonly procesando = signal(false);

  protected confirmarBaja(): void {
    this.confirmandoBaja.set(false);
    this.procesando.set(true);
    this.error.set(null);
    this.perfilService.dejarPremium().subscribe({
      next: (respuesta) => {
        this.perfil.set(respuesta.perfil);
        const quitados = respuesta.productosQuitadosDelCarrito;
        this.mensajeExito.set(
          quitados > 0
            ? `Has vuelto al plan estándar. Hemos quitado de tu carrito ${quitados} producto(s) solo para Premium.`
            : 'Has vuelto al plan estándar.',
        );
        this.procesando.set(false);
        void this.auth.restaurarSesion();
      },
      error: (e) => {
        this.procesando.set(false);
        this.error.set(mensajeDeError(e));
      },
  });
}

  protected readonly confirmandoBajaCuenta = signal(false);
  protected readonly procesandoBajaCuenta = signal(false);
  protected readonly errorBajaCuenta = signal<string | null>(null);
  protected readonly cuentaEliminada = signal(false);
  protected readonly mensajeBajaCuenta = computed(() =>
    this.perfil()?.rol === 'VENDEDOR'
      ? 'Se eliminarán tu cuenta y todos tus productos de la plataforma. Esta acción no se puede deshacer.'
      : 'Se eliminarán tu cuenta y tus datos y Perderás el acceso a tus pedidos; Esta acción no se puede deshacer.',
  );

  protected confirmarBajaCuenta(): void {
    this.procesandoBajaCuenta.set(true);
    this.errorBajaCuenta.set(null);
    this.perfilService.darseDeBaja().subscribe({
      next: () => {
        this.auth.cuentaEliminada();
        this.perfil.set(null);
        this.confirmandoBajaCuenta.set(false);
        this.procesandoBajaCuenta.set(false);
        this.cuentaEliminada.set(true);
      },
      error: (e) => {
        this.confirmandoBajaCuenta.set(false);
        this.procesandoBajaCuenta.set(false);
        this.errorBajaCuenta.set(mensajeDeError(e));
      },
    });
  }
}