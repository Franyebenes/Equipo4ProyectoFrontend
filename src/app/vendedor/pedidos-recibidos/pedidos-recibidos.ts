import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { EstadoPedido } from '../../cliente/pedido.service';
import { formatearPrecio } from '../producto.service';
import {
  ESTADOS_FILTRO,
  PedidoRecibido,
  PedidoVendedorService,
  esEstadoFiltrable,
  etiquetaEstadoPedido,
  formatearFechaPedido,
  mensajeErrorPedidosRecibidos,
  referenciaPedido,
  textoUnidades,
} from '../pedido-vendedor.service';

// Ver pedidos recibidos: los pedidos de los productos del vendedor de la sesión, los más recientes primero.
// Siempre se leen del backend, que solo devuelve los suyos. El filtro por estado se aplica aquí y se guarda en
// la dirección de la página (?estado=...), así que se conserva al recargar y al volver del detalle de un pedido.
@Component({
  selector: 'app-pedidos-recibidos',
  imports: [RouterLink, FormsModule],
  templateUrl: './pedidos-recibidos.html',
  // La tabla usa los mismos estilos que Mi catálogo
  styleUrls: [
    '../../admin/admin-shared.css',
    '../vendedor-shared.css',
    '../mis-productos/mis-productos.css',
    './pedidos-recibidos.css',
  ],
})
export class PedidosRecibidos implements OnInit {
  private pedidoService = inject(PedidoVendedorService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly estados = ESTADOS_FILTRO;
  readonly formatearPrecio = formatearPrecio;
  readonly formatearFecha = formatearFechaPedido;
  readonly etiquetaEstado = etiquetaEstadoPedido;
  readonly referencia = referenciaPedido;
  readonly textoUnidades = textoUnidades;

  pedidos = signal<PedidoRecibido[]>([]);
  cargando = signal(false);
  error = signal('');
  estado = signal<EstadoPedido | ''>('');

  // Pedidos que se muestran: todos o solo los del estado elegido
  visibles = computed(() => {
    const estado = this.estado();
    return estado ? this.pedidos().filter((p) => p.estado === estado) : this.pedidos();
  });

  // Mensaje cuando hay pedidos, pero ninguno en el estado elegido
  sinResultados = computed(() => {
    const estado = this.estado();
    return estado ? `No tienes pedidos en estado «${etiquetaEstadoPedido(estado)}».` : '';
  });

  // Se pasa al detalle para que, al volver, siga el mismo filtro
  parametrosFiltro = computed(() => (this.estado() ? { estado: this.estado() } : {}));

  ngOnInit(): void {
    const estado = this.route.snapshot.queryParamMap.get('estado');
    if (esEstadoFiltrable(estado)) {
      this.estado.set(estado);
    }
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.pedidoService.listar().subscribe({
      next: (lista) => {
        this.pedidos.set(lista);
        this.cargando.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.cargando.set(false);
        this.error.set(mensajeErrorPedidosRecibidos(e));
      },
    });
  }

  cambiarEstado(estado: EstadoPedido | ''): void {
    this.estado.set(estado);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { estado: estado || null },
      replaceUrl: true,
    });
  }
}
