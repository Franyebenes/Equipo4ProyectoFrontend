import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, signal } from '@angular/core';

import { CarritoService } from '../carrito.service';

// HU-22.2 Botón "Añadir al carrito", para usarlo en la ficha o en el listado de productos:
//   <app-boton-anadir-carrito [idProducto]="producto.id" />
@Component({
  selector: 'app-boton-anadir-carrito',
  template: `
    <button type="button" class="btn-carrito" (click)="anadir()" [disabled]="estado() === 'enviando'">
      @switch (estado()) {
        @case ('enviando') { Añadiendo… }
        @case ('anadido') { ✓ Añadido }
        @default { Añadir al carrito }
      }
    </button>
    @if (error()) {
      <p class="error-carrito" role="alert">{{ error() }}</p>
    }
  `,
  styles: `
    .btn-carrito {
      padding: .7rem 1.4rem; border: none; border-radius: 999px;
      background: #ff6b4a; color: #fff; font-weight: 600; cursor: pointer;
    }
    .btn-carrito:disabled { opacity: .6; cursor: wait; }
    .error-carrito { color: #b3261e; font-size: .9rem; margin-top: .5rem; }
  `,
})
export class BotonAnadirCarrito {
  private readonly carritoService = inject(CarritoService);

  readonly idProducto = input.required<string>();
  readonly cantidad = input(1);

  readonly estado = signal<'listo' | 'enviando' | 'anadido'>('listo');
  readonly error = signal<string | null>(null);

  anadir(): void {
    this.estado.set('enviando');
    this.error.set(null);
    this.carritoService.anadir(this.idProducto(), this.cantidad()).subscribe({
      next: () => {
        this.estado.set('anadido');
        setTimeout(() => this.estado.set('listo'), 2000);
      },
      error: (e: unknown) => {
        this.estado.set('listo');
        const mensaje = e instanceof HttpErrorResponse ? e.error?.mensaje : null;
        this.error.set(mensaje ?? 'No se ha podido añadir al carrito. Inténtalo de nuevo.');
      },
    });
  }
}