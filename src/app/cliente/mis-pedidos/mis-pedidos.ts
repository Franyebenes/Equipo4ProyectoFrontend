import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { DialogoConfirmacion } from '../../admin/dialogo-confirmacion/dialogo-confirmacion';
import { formatearPrecio } from '../../vendedor/producto.service';
import {
  ETIQUETA_ESTADO_PEDIDO,
  HistorialPedidos,
  LineaPedido,
  Pedido,
  PedidoService,
  mensajeErrorPedidos,
  sePuedeCancelar,
  sePuedeConfirmarRecepcion,
} from '../pedido.service';
import { VentanaSeguimiento } from '../seguimiento-pedido/seguimiento-pedido';

// HU-27 Historial de compras (solo lectura), HU-28 Cancelar pedido y HU-30 Confirmar recepción y valorar producto.
// Siempre se lee del backend, así que muestra el estado actual de cada pedido. Tras cancelar, confirmar o valorar, los
// botones de ese pedido siguen desactivados hasta que llega la lista nueva, para no actuar sobre un estado antiguo.
// Cancelar y confirmar la recepción no tienen vuelta atrás, así que los dos piden confirmación antes.
// Estado del envío: desde cada pedido en proceso se abre la ventana con su seguimiento (los históricos ya han
// terminado, así que no lo necesitan).
@Component({
  selector: 'app-mis-pedidos',
  imports: [RouterLink, NgTemplateOutlet, DialogoConfirmacion, VentanaSeguimiento],
  templateUrl: './mis-pedidos.html',
  styleUrl: './mis-pedidos.css',
})
export class MisPedidos implements OnInit {
  private readonly pedidoService = inject(PedidoService);
  private readonly router = inject(Router);

  readonly formatearPrecio = formatearPrecio;
  readonly sePuedeCancelar = sePuedeCancelar;
  readonly sePuedeConfirmarRecepcion = sePuedeConfirmarRecepcion;
  readonly estrellas = [1, 2, 3, 4, 5];

  readonly historial = signal<HistorialPedidos | null>(null);
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly exito = signal('');
  // Error al cancelar, confirmar la recepción o valorar: se muestra sin ocultar las listas
  readonly errorAccion = signal('');
  // Pedido sobre el que hay una petición en curso o cuya lista se está recargando (desactiva sus botones)
  readonly ocupado = signal<string | null>(null);
  // Pedido pendiente de confirmar su cancelación (abre el diálogo)
  readonly pedidoACancelar = signal<Pedido | null>(null);
  readonly cancelando = signal(false);
  // HU-30: pedido pendiente de confirmar que se ha recibido (abre el diálogo)
  readonly pedidoARecibir = signal<Pedido | null>(null);
  readonly confirmandoRecepcion = signal(false);
  // Estado del envío: pedido cuyo seguimiento se está viendo (abre la ventana)
  readonly pedidoEnSeguimiento = signal<string | null>(null);

  constructor() {
    // Aviso que deja el carrito al realizar un pedido
    const exito = this.router.currentNavigation()?.extras.state?.['exito'];
    if (typeof exito === 'string') {
      this.exito.set(exito);
    }
  }

  ngOnInit(): void {
    this.cargar();
  }

  verSeguimiento(pedido: Pedido): void {
    this.pedidoEnSeguimiento.set(pedido.id);
  }

  cerrarSeguimiento(): void {
    this.pedidoEnSeguimiento.set(null);
  }

  // alTerminar se llama cuando ya ha llegado la lista (o el error), por ejemplo para volver a activar los botones
  cargar(alTerminar?: () => void): void {
    this.error.set('');
    this.pedidoService.historial().subscribe({
      next: (historial) => {
        this.historial.set(historial);
        this.cargando.set(false);
        alTerminar?.();
      },
      error: (e: HttpErrorResponse) => {
        this.cargando.set(false);
        this.error.set(mensajeErrorPedidos(e));
        alTerminar?.();
      },
    });
  }

  // Recarga la lista y no libera los botones del pedido hasta que llega
  private recargarYLiberar(): void {
    this.cargar(() => this.ocupado.set(null));
  }

  // HU-28: primero se pide confirmación; si se cancela el diálogo, el pedido no cambia
  pedirCancelacion(pedido: Pedido): void {
    this.exito.set('');
    this.errorAccion.set('');
    this.pedidoACancelar.set(pedido);
  }

  cerrarCancelacion(): void {
    if (!this.cancelando()) {
      this.pedidoACancelar.set(null);
    }
  }

  confirmarCancelacion(): void {
    const pedido = this.pedidoACancelar();
    if (!pedido) {
      return;
    }
    this.cancelando.set(true);
    this.ocupado.set(pedido.id);
    this.pedidoService.cancelar(pedido.id).subscribe({
      next: () => {
        this.cancelando.set(false);
        this.pedidoACancelar.set(null);
        this.exito.set('Pedido cancelado. Las unidades vuelven a estar disponibles.');
        this.recargarYLiberar();
      },
      error: (e: HttpErrorResponse) => {
        this.cancelando.set(false);
        this.pedidoACancelar.set(null);
        this.errorAccion.set(mensajeErrorPedidos(e));
        this.recargarYLiberar();
      },
    });
  }

  // HU-30: primero se pide confirmación, porque después el pedido queda finalizado y no se puede deshacer
  pedirConfirmacionRecepcion(pedido: Pedido): void {
    this.exito.set('');
    this.errorAccion.set('');
    this.pedidoARecibir.set(pedido);
  }

  cerrarConfirmacionRecepcion(): void {
    if (!this.confirmandoRecepcion()) {
      this.pedidoARecibir.set(null);
    }
  }

  // HU-30: el pedido pasa a Finalizado y desde entonces se pueden valorar sus productos
  confirmarRecepcion(): void {
    const pedido = this.pedidoARecibir();
    if (!pedido) {
      return;
    }
    this.confirmandoRecepcion.set(true);
    this.ocupado.set(pedido.id);
    this.pedidoService.confirmarRecepcion(pedido.id).subscribe({
      next: () => {
        this.confirmandoRecepcion.set(false);
        this.pedidoARecibir.set(null);
        this.exito.set('Gracias por confirmar la recepción. Ya puedes valorar los productos de este pedido.');
        this.recargarYLiberar();
      },
      error: (e: HttpErrorResponse) => {
        this.confirmandoRecepcion.set(false);
        this.pedidoARecibir.set(null);
        this.errorAccion.set(mensajeErrorPedidos(e));
        this.recargarYLiberar();
      },
    });
  }

  // HU-30: una sola valoración por producto y pedido; después las estrellas quedan fijas
  valorar(pedido: Pedido, linea: LineaPedido, puntos: number): void {
    this.exito.set('');
    this.errorAccion.set('');
    this.ocupado.set(pedido.id);
    this.pedidoService.valorar(pedido.id, linea.idProducto, puntos).subscribe({
      next: () => {
        this.exito.set(`Gracias por valorar «${linea.nombre}».`);
        this.recargarYLiberar();
      },
      error: (e: HttpErrorResponse) => {
        this.errorAccion.set(mensajeErrorPedidos(e));
        this.recargarYLiberar();
      },
    });
  }

  fecha(pedido: Pedido): string {
    return new Date(pedido.fecha).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
  }

  etiquetaEstado(pedido: Pedido): string {
    return ETIQUETA_ESTADO_PEDIDO[pedido.estado];
  }

  mensajeConfirmarCancelacion(pedido: Pedido): string {
    return (
      `¿Seguro que quieres cancelar el pedido del ${this.fecha(pedido)} ` +
      `por ${formatearPrecio(pedido.precioTotal)}? Las unidades volverán al stock y esta acción no se puede deshacer.`
    );
  }

  mensajeConfirmarRecepcion(pedido: Pedido): string {
    return (
      `¿Confirmas que ya tienes el pedido del ${this.fecha(pedido)} por ${formatearPrecio(pedido.precioTotal)}? ` +
      'Pasará a «Finalizado» y podrás valorar sus productos. Esta acción no se puede deshacer.'
    );
  }
}
