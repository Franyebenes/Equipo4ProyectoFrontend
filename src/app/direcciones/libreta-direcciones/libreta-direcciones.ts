import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { mensajeDeError } from '../../core/mensaje-error';
import { Direccion, DireccionService, lineaCalle } from '../direccion.service';

/** Libreta de direcciones del cliente . */
@Component({
  selector: 'app-libreta-direcciones',
  imports: [RouterLink],
  templateUrl: './libreta-direcciones.html',
  styleUrl: './libreta-direcciones.css',
})
export class LibretaDirecciones {
  private readonly servicio = inject(DireccionService);

  protected readonly direcciones = signal<Direccion[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  /** Id de la dirección cuyo borrado se está confirmando */
  protected readonly confirmandoBorrado = signal<string | null>(null);
  protected readonly lineaCalle = lineaCalle;

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.servicio.listar().subscribe({
      next: (lista) => {
        this.direcciones.set(lista);
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(mensajeDeError(e));
        this.cargando.set(false);
      },
    });
  }

  protected hacerPredeterminada(direccion: Direccion): void {
    this.error.set(null);
    this.servicio.marcarPredeterminada(direccion.id).subscribe({
      next: () => this.cargar(),
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  protected eliminar(direccion: Direccion): void {
    this.confirmandoBorrado.set(null);
    this.error.set(null);
    this.servicio.eliminar(direccion.id).subscribe({
      next: () => this.cargar(),
      // Un 409 trae "No puedes modificar ni eliminar una direccion usada en un pedido que todavia esta en curso"
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }
}