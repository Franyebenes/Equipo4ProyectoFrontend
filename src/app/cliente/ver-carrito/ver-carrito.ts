import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { Carrito, CarritoService, LineaCarrito } from '../carrito.service';
import { PedidoService, mensajeErrorPedidos, validarDireccion } from '../pedido.service';

// HU-22.1 Ver carrito, HU-22.3 Modificar cantidad, HU-22.4 Eliminar del carrito y HU-26 Realizar pedido
@Component({
  selector: 'app-ver-carrito',
  imports: [RouterLink, FormsModule],
  templateUrl: './ver-carrito.html',
  styleUrl: './ver-carrito.css',
})
export class VerCarrito implements OnInit {
  private readonly carritoService = inject(CarritoService);
  private readonly pedidoService = inject(PedidoService);
  private readonly router = inject(Router);

  readonly carrito = signal<Carrito | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  /** Producto que se está actualizando, para desactivar sus botones mientras tanto. */
  readonly ocupado = signal<string | null>(null);

  // HU-26: al tramitar el pedido se pide la dirección de envío. El pago es simulado: no se piden datos de pago.
  readonly tramitando = signal(false);
  readonly calle = signal('');
  readonly ciudad = signal('');
  readonly codigoPostal = signal('');
  readonly enviandoPedido = signal(false);
  readonly errorPedido = signal<string | null>(null);

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

  tramitar(): void {
    this.errorPedido.set(null);
    this.tramitando.set(true);
  }

  cancelarTramite(): void {
    if (!this.enviandoPedido()) {
      this.tramitando.set(false);
    }
  }

  // Crea el pedido con lo que hay en el carrito y lleva al historial, donde se ve ya como pagado
  confirmarPedido(): void {
    const direccion = {
      calle: this.calle().trim(),
      ciudad: this.ciudad().trim(),
      codigoPostal: this.codigoPostal().trim(),
    };
    const error = validarDireccion(direccion);
    if (error) {
      this.errorPedido.set(error);
      return;
    }
    this.errorPedido.set(null);
    this.enviandoPedido.set(true);
    this.pedidoService.realizar(direccion).subscribe({
      next: () => {
        this.carritoService.numeroArticulos.set(0);
        void this.router.navigate(['/pedidos'], {
          state: { exito: 'Pedido realizado. Puedes seguirlo desde aquí.' },
        });
      },
      error: (e: HttpErrorResponse) => {
        this.enviandoPedido.set(false);
        this.errorPedido.set(mensajeErrorPedidos(e));
      },
    });
  }

  private actualizar(linea: LineaCarrito, peticion: ReturnType<CarritoService['obtener']>): void {
    this.ocupado.set(linea.idProducto);
    this.error.set(null);
    peticion.subscribe({
      next: (c) => {
        this.carrito.set(c);
        this.ocupado.set(null);
      },
      error: (e) => {
        this.mostrarError(e);
        this.ocupado.set(null);
      },
    });
  }

  private mostrarError(e: unknown): void {
    const mensaje = e instanceof HttpErrorResponse ? e.error?.mensaje : null;
    this.error.set(mensaje ?? 'No se ha podido actualizar el carrito. Inténtalo de nuevo.');
  }
}
