import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '../core/api';
import { ETIQUETA_ESTADO_PEDIDO, EstadoPedido } from './pedido.service';

// Un paso del envío (PasoSeguimientoDTO en el backend): si ya se ha alcanzado, si es el actual y cuándo se
// alcanzó (null si aún no ha llegado o, en pedidos antiguos, si no se sabe)
export interface PasoSeguimiento {
  estado: EstadoPedido;
  completado: boolean;
  actual: boolean;
  fecha: string | null;
}

// Estado del envío de un pedido (SeguimientoPedidoDTO). fechaEntregaEstimada es un día (AAAA-MM-DD) y solo
// viene mientras el pedido va de camino; fechaEntrega, cuando ya se ha entregado. Si disponible es false
// (pedido cancelado), no hay pasos que mostrar.
export interface SeguimientoPedido {
  id: string;
  estado: EstadoPedido;
  fecha: string;
  fechaActualizacion: string;
  fechaEntregaEstimada: string | null;
  fechaEntrega: string | null;
  disponible: boolean;
  pasos: PasoSeguimiento[];
}

export function etiquetaEstado(estado: EstadoPedido): string {
  return ETIQUETA_ESTADO_PEDIDO[estado] ?? estado;
}

// Día y hora (p. ej. 03/11/26, 11:00)
export function formatearMomento(fecha: string): string {
  return new Date(fecha).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
}

// Un día AAAA-MM-DD en palabras (p. ej. «sábado, 7 de noviembre»). Se crea con la fecha local para que no
// cambie de día según la zona horaria del navegador.
export function formatearDia(dia: string): string {
  const [anio, mes, numero] = dia.split('-').map(Number);
  return new Date(anio, mes - 1, numero).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

// Aviso cuando no hay seguimiento que mostrar
export function textoSinSeguimiento(seguimiento: SeguimientoPedido): string {
  return seguimiento.estado === 'CANCELADO'
    ? 'Este pedido está cancelado, así que no tiene seguimiento de envío.'
    : 'La información de seguimiento de este pedido no está disponible en este momento.';
}

export function mensajeErrorSeguimiento(e: HttpErrorResponse): string {
  switch (e.status) {
    case 0:
      return 'No se puede conectar con el servidor. ¿Está arrancado el backend?';
    case 401:
      return 'Tu sesión ha caducado. Inicia sesión de nuevo.';
    case 403:
      return 'Solo los clientes pueden consultar el seguimiento de sus pedidos.';
    default:
      return e.error?.mensaje ?? 'No se ha podido cargar el seguimiento. Inténtalo de nuevo.';
  }
}

// Estado del envío. El backend solo devuelve el seguimiento de los pedidos del cliente de la sesión (si no, 404).
// Cada consulta lee el estado más reciente: no se guarda nada en el navegador.
@Injectable({ providedIn: 'root' })
export class SeguimientoService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_URL)}/api/pedidos`;

  obtener(idPedido: string): Observable<SeguimientoPedido> {
    return this.http.get<SeguimientoPedido>(`${this.url}/${encodeURIComponent(idPedido)}/seguimiento`);
  }
}
