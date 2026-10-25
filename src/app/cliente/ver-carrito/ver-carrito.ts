import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Carrito, CarritoService, LineaCarrito } from '../carrito.service';

// HU-22.1 Ver carrito, HU-22.3 Modificar cantidad y HU-22.4 Eliminar del carrito
@Component({
  selector: 'app-ver-carrito',
  imports: [RouterLink],
  templateUrl: './ver-carrito.html',
  styleUrl: './ver-carrito.css',
})
export class VerCarrito implements OnInit {
  private readonly carritoService = inject(CarritoService);

  readonly carrito = signal<Carrito | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  /** Producto que se está actualizando, para desactivar sus botones mientras tanto. */
  readonly ocupado = signal<string | null>(null);

  ngOnInit(): void {
    this.carritoService.obtener().subscribe({
      next: (c) => {
        this.carrito.set(c);
        this.cargando.set(false);
      },
      error: (e) => {
        this.mostrarError(e);
        this.cargando.set(false);
      },
    });
  }

  sumar(linea: LineaCarrito): void {
    this.actualizar(linea, this.carritoService.cambiarCantidad(linea.idProducto, linea.cantidad + 1));
  }

  restar(linea: LineaCarrito): void {
    if (linea.cantidad > 1) {
      this.actualizar(linea, this.carritoService.cambiarCantidad(linea.idProducto, linea.cantidad - 1));
    }
  }

  eliminar(linea: LineaCarrito): void {
    this.actualizar(linea, this.carritoService.eliminar(linea.idProducto));
  }

  /** Error al cambiar la cantidad o eliminar: sale dentro de la línea de ese producto, no arriba del todo. */
  readonly errorLinea = signal<{ idProducto: string; mensaje: string } | null>(null);

  errorDe(linea: LineaCarrito): string | null {
    const error = this.errorLinea();
    return error?.idProducto === linea.idProducto ? error.mensaje : null;
  }

  tieneDescuento(linea: LineaCarrito): boolean {
    return linea.precioUnitario < linea.precioOriginal;
  }

  precio(importe: number): string {
    return importe.toFixed(2).replace('.', ',') + ' €';
  }

  // La imagen se guarda en base64: si no trae ya el prefijo "data:", se le añade
  imagenDe(imagen: string): string {
    return imagen.startsWith('data:') ? imagen : `data:image/png;base64,${imagen}`;
  }

  private actualizar(linea: LineaCarrito, peticion: ReturnType<CarritoService['obtener']>): void {
    this.ocupado.set(linea.idProducto);
    this.error.set(null);
    peticion.subscribe({
      next: (c) => {
        this.carrito.set(c);
        this.errorLinea.set(null);
        this.ocupado.set(null);
      },
      error: (e) => {
        const mensaje = e instanceof HttpErrorResponse ? e.error?.mensaje : null;
        this.errorLinea.set({
          idProducto: linea.idProducto,
          mensaje: mensaje ?? 'No se ha podido actualizar este producto. Inténtalo de nuevo.',
        });
        this.ocupado.set(null);
      },
    });
  }

  private mostrarError(e: unknown): void {
    const mensaje = e instanceof HttpErrorResponse ? e.error?.mensaje : null;
    this.error.set(mensaje ?? 'No se ha podido actualizar el carrito. Inténtalo de nuevo.');
  }
}