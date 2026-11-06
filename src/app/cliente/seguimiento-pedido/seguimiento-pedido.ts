import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import { VentanaInfo } from '../../compartido/ventana-info/ventana-info';
import {
  SeguimientoPedido,
  SeguimientoService,
  etiquetaEstado,
  formatearDia,
  formatearMomento,
  mensajeErrorSeguimiento,
  textoSinSeguimiento,
} from '../seguimiento.service';

// Estado del envío: ventana con el seguimiento de un pedido (estado actual, fechas y pasos del envío). Se abre desde
// «Mis pedidos». Al abrirla y al pulsar «Actualizar» se pide al backend, así que siempre muestra lo más reciente.
@Component({
  selector: 'app-seguimiento-pedido',
  imports: [VentanaInfo],
  templateUrl: './seguimiento-pedido.html',
  styleUrl: './seguimiento-pedido.css',
})
export class VentanaSeguimiento implements OnInit {
  private readonly seguimientoService = inject(SeguimientoService);

  readonly idPedido = input.required<string>();
  readonly cerrar = output<void>();

  readonly etiquetaEstado = etiquetaEstado;
  readonly formatearDia = formatearDia;
  readonly formatearMomento = formatearMomento;
  readonly textoSinSeguimiento = textoSinSeguimiento;

  readonly seguimiento = signal<SeguimientoPedido | null>(null);
  readonly cargando = signal(true);
  readonly error = signal('');

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.seguimientoService.obtener(this.idPedido()).subscribe({
      next: (seguimiento) => {
        this.seguimiento.set(seguimiento);
        this.cargando.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.cargando.set(false);
        this.error.set(mensajeErrorSeguimiento(e));
      },
    });
  }
}
