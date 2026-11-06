import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { formatearPrecio } from '../producto.service';
import {
  PedidoRecibidoDetalle,
  PedidoVendedorService,
  esEstadoFiltrable,
  etiquetaEstadoPedido,
  formatearFechaPedido,
  mensajeErrorPedidosRecibidos,
  referenciaPedido,
  textoUnidades,
} from '../pedido-vendedor.service';

// Detalle de un pedido recibido: cliente, dirección de envío y productos. Se pide al backend al entrar, que solo
// lo devuelve si es del vendedor de la sesión (si no, 404 con su mensaje).
@Component({
  selector: 'app-detalle-pedido-recibido',
  imports: [RouterLink],
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

  pedido = signal<PedidoRecibidoDetalle | null>(null);
  cargando = signal(true);
  error = signal('');
  // Al volver al listado se recupera el filtro por estado que tenía
  filtroListado: Record<string, string> = {};

  ngOnInit(): void {
    const estado = this.route.snapshot.queryParamMap.get('estado');
    if (esEstadoFiltrable(estado)) {
      this.filtroListado = { estado };
    }
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.pedidoService.obtener(id).subscribe({
      next: (pedido) => {
        this.pedido.set(pedido);
        this.cargando.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.cargando.set(false);
        this.error.set(mensajeErrorPedidosRecibidos(e));
      },
    });
  }
}
