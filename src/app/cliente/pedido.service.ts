import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '../core/api';

// Mismos valores que el enum EstadoPedido del backend. El pago es simulado: el pedido nace PAGADO.
export type EstadoPedido = 'PENDIENTE' | 'PAGADO' | 'ENVIADO' | 'ENTREGADO' | 'FINALIZADO' | 'CANCELADO';

export interface DireccionEnvio {
  calle: string;
  ciudad: string;
  codigoPostal: string;
}

export interface LineaPedido {
  idProducto: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number; // lo que se pagó por unidad, ya con el descuento que tenía el cliente
  subtotal: number;
  valoracion: number | null; // estrellas (1-5) que el cliente dio al producto en este pedido, o null si aún no lo ha valorado
}

export interface Pedido {
  id: string;
  estado: EstadoPedido;
  fecha: string;
  precioTotal: number;
  direccionEnvio: DireccionEnvio;
  lineas: LineaPedido[];
}

// HU-27: los pedidos en curso y los que ya han terminado (finalizados o cancelados), los más recientes primero
export interface HistorialPedidos {
  enProceso: Pedido[];
  historicos: Pedido[];
}

export const ETIQUETA_ESTADO_PEDIDO: Record<EstadoPedido, string> = {
  PENDIENTE: 'Pendiente',
  PAGADO: 'Pagado',
  ENVIADO: 'Enviado',
  ENTREGADO: 'Entregado',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
};

// HU-28: solo se puede cancelar mientras está pagado y aún no se ha enviado (misma regla que el backend)
export function sePuedeCancelar(pedido: Pedido): boolean {
  return pedido.estado === 'PAGADO';
}

// HU-30: el cliente confirma la recepción mientras el pedido sigue en curso
export function sePuedeConfirmarRecepcion(pedido: Pedido): boolean {
  return pedido.estado === 'PAGADO' || pedido.estado === 'ENVIADO' || pedido.estado === 'ENTREGADO';
}

// Comprueba la dirección antes de enviarla (mismas reglas que el backend). Devuelve el error o '' si es válida.
export function validarDireccion(direccion: DireccionEnvio): string {
  if (!direccion.calle.trim() || !direccion.ciudad.trim() || !direccion.codigoPostal.trim()) {
    return 'Indica la calle, la ciudad y el código postal de envío.';
  }
  if (!/^\d{5}$/.test(direccion.codigoPostal.trim())) {
    return 'El código postal debe tener 5 números.';
  }
  return '';
}

// Mensajes para el cliente. El 401 además lo gestiona el interceptor (vuelve al login).
export function mensajeErrorPedidos(e: HttpErrorResponse): string {
  switch (e.status) {
    case 0:
      return 'No se puede conectar con el servidor. ¿Está arrancado el backend?';
    case 401:
      return 'Tu sesión ha caducado. Inicia sesión de nuevo.';
    case 403:
      return 'Solo los clientes pueden gestionar sus pedidos.';
    default:
      return e.error?.mensaje ?? 'Ha ocurrido un error. Inténtalo de nuevo.';
  }
}

// Pedidos del cliente de la sesión (HU-26 a HU-30). El token CSRF y la cookie de sesión los añade apiInterceptor.
@Injectable({ providedIn: 'root' })
export class PedidoService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_URL)}/api/pedidos`;

  // HU-26: convierte el carrito en un pedido pagado y devuelve el pedido creado
  realizar(direccionEnvio: DireccionEnvio): Observable<Pedido> {
    return this.http.post<Pedido>(this.url, { direccionEnvio });
  }

  // HU-27
  historial(): Observable<HistorialPedidos> {
    return this.http.get<HistorialPedidos>(this.url);
  }

  // HU-28: devuelve el pedido ya cancelado
  cancelar(idPedido: string): Observable<Pedido> {
    return this.http.post<Pedido>(`${this.url}/${idPedido}/cancelar`, null);
  }

  // HU-30: devuelve el pedido ya finalizado
  confirmarRecepcion(idPedido: string): Observable<Pedido> {
    return this.http.post<Pedido>(`${this.url}/${idPedido}/recepcion`, null);
  }

  // HU-30: valora de 1 a 5 un producto del pedido (el backend responde 204, sin cuerpo)
  valorar(idPedido: string, idProducto: string, puntos: number): Observable<void> {
    return this.http.post<void>(`${this.url}/${idPedido}/productos/${idProducto}/valoracion`, { puntos });
  }
}
