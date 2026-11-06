import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { DialogoConfirmacion } from '../../admin/dialogo-confirmacion/dialogo-confirmacion';
import { EstadoPedido } from '../../cliente/pedido.service';
import { formatearDia } from '../../cliente/seguimiento.service';
import { formatearPrecio } from '../producto.service';
import {
  ESTADOS_CON_FECHA_ENTREGA,
  PedidoRecibidoDetalle,
  PedidoVendedorService,
  diaDeHoy,
  esEstadoFiltrable,
  etiquetaEstadoPedido,
  formatearFechaPedido,
  mensajeConfirmarCambioEstado,
  mensajeErrorPedidosRecibidos,
  mensajeEstadoActualizado,
  referenciaPedido,
  textoUnidades,
} from '../pedido-vendedor.service';

// Detalle de un pedido recibido: cliente, dirección de envío y productos. Se pide al backend al entrar, que solo
// lo devuelve si es del vendedor de la sesión (si no, 404 con su mensaje).
// Procesar estado del pedido: desde aquí el vendedor hace avanzar el envío. Los estados que se ofrecen son los que
// devuelve el backend (estadosSiguientes) y el cambio se confirma antes de hacerlo, porque no se puede deshacer.
// Estado del envío: al enviarlo puede indicar la fecha estimada de entrega que verá el cliente (si no, se calcula).
@Component({
  selector: 'app-detalle-pedido-recibido',
  imports: [RouterLink, FormsModule, DialogoConfirmacion],
  templateUrl: './detalle-pedido-recibido.html',
  // La ficha usa los mismos estilos que el detalle de un producto
  styleUrls: [
    '../../admin/admin-shared.css',
    '../vendedor-shared.css',
    '../detalle-producto/detalle-producto.css',
    './detalle-pedido-recibido.css',
  ],
})
export class DetallePedidoRecibido implements OnInit {
  private pedidoService = inject(PedidoVendedorService);
  private route = inject(ActivatedRoute);

  readonly formatearPrecio = formatearPrecio;
  readonly formatearFecha = formatearFechaPedido;
  readonly etiquetaEstado = etiquetaEstadoPedido;
  readonly referencia = referenciaPedido;
  readonly textoUnidades = textoUnidades;
  readonly formatearDia = formatearDia;
  readonly hoy = diaDeHoy();

  pedido = signal<PedidoRecibidoDetalle | null>(null);
  cargando = signal(true);
  error = signal('');
  // Al volver al listado se recupera el filtro por estado que tenía
  filtroListado: Record<string, string> = {};

  // Procesar estado del pedido
  nuevoEstado = signal<EstadoPedido | ''>('');
  confirmandoCambio = signal(false);
  guardandoEstado = signal(false);
  exitoEstado = signal('');
  errorEstado = signal('');
  // Estado del envío: fecha estimada de entrega que indica el vendedor (AAAA-MM-DD, opcional)
  fechaEntrega = signal('');
  pideFechaEntrega = computed(() => {
    const nuevo = this.nuevoEstado();
    return nuevo !== '' && ESTADOS_CON_FECHA_ENTREGA.includes(nuevo);
  });

  ngOnInit(): void {
    const estado = this.route.snapshot.queryParamMap.get('estado');
    if (esEstadoFiltrable(estado)) {
      this.filtroListado = { estado };
    }
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.pedidoService.obtener(id).subscribe({
      next: (pedido) => {
        this.mostrar(pedido);
        this.cargando.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.cargando.set(false);
        this.error.set(mensajeErrorPedidosRecibidos(e));
      },
    });
  }

  mensajeConfirmacion(pedido: PedidoRecibidoDetalle): string {
    const nuevo = this.nuevoEstado();
    return nuevo ? mensajeConfirmarCambioEstado(pedido, nuevo, this.fechaEntregaElegida()) : '';
  }

  pedirConfirmacion(): void {
    this.exitoEstado.set('');
    this.errorEstado.set('');
    if (this.nuevoEstado()) {
      this.confirmandoCambio.set(true);
    }
  }

  cancelarCambio(): void {
    if (!this.guardandoEstado()) {
      this.confirmandoCambio.set(false);
    }
  }

  confirmarCambio(pedido: PedidoRecibidoDetalle): void {
    const nuevo = this.nuevoEstado();
    if (!nuevo) {
      return;
    }
    this.guardandoEstado.set(true);
    this.pedidoService.cambiarEstado(pedido.id, nuevo, this.fechaEntregaElegida()).subscribe({
      next: (actualizado) => {
        this.guardandoEstado.set(false);
        this.confirmandoCambio.set(false);
        this.mostrar(actualizado);
        this.exitoEstado.set(mensajeEstadoActualizado(actualizado.estado));
      },
      error: (e: HttpErrorResponse) => {
        this.guardandoEstado.set(false);
        this.confirmandoCambio.set(false);
        this.errorEstado.set(mensajeErrorPedidosRecibidos(e));
        // 409: el pedido ya no está como se veía (p. ej. el cliente lo acaba de cancelar). Se recarga para ver
        // su estado real, sin quitar el mensaje.
        if (e.status === 409) {
          this.recargar(pedido.id);
        }
      },
    });
  }

  // Solo se envía si el estado elegido la admite y se ha rellenado
  private fechaEntregaElegida(): string | null {
    return this.pideFechaEntrega() && this.fechaEntrega() ? this.fechaEntrega() : null;
  }

  // Muestra el pedido y propone como nuevo estado el siguiente paso del envío
  private mostrar(pedido: PedidoRecibidoDetalle): void {
    this.pedido.set(pedido);
    this.nuevoEstado.set(pedido.estadosSiguientes[0] ?? '');
    this.fechaEntrega.set('');
  }

  private recargar(id: string): void {
    this.pedidoService.obtener(id).subscribe({ next: (pedido) => this.mostrar(pedido) });
  }
}
