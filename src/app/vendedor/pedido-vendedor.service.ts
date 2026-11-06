import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '../core/api';
import { DireccionEnvio, ETIQUETA_ESTADO_PEDIDO, EstadoPedido } from '../cliente/pedido.service';
import { formatearDia } from '../cliente/seguimiento.service';

// Pedido en el listado de pedidos recibidos (PedidoRecibidoDTO en el backend). cliente es su nombre y apellidos
// (o su email si no los tiene); importe, lo que pagó por todo el pedido; unidades, la suma de todas las líneas.
export interface PedidoRecibido {
  id: string;
  fecha: string;
  cliente: string;
  importe: number;
  estado: EstadoPedido;
  unidades: number;
}

// Una línea del pedido: lo que pagó el cliente por cada unidad (ya con su descuento) y el subtotal
export interface LineaPedidoRecibido {
  idProducto: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

// Detalle de un pedido recibido (PedidoRecibidoDetalleDTO): lo del listado más la dirección de envío y las líneas.
// fechaActualizacion es el último cambio del pedido; fechaEntregaEstimada, el día (AAAA-MM-DD) que ve el cliente
// (null si ya no va de camino) y estadosSiguientes, los estados a los que el vendedor lo puede llevar ahora (vacío
// si ya está entregado, finalizado o cancelado). El backend decide cuáles son.
export interface PedidoRecibidoDetalle extends PedidoRecibido {
  fechaActualizacion: string;
  fechaEntregaEstimada: string | null;
  estadosSiguientes: EstadoPedido[];
  direccionEnvio: DireccionEnvio | null;
  lineas: LineaPedidoRecibido[];
}

// Referencia corta para mostrar el pedido: los 8 últimos caracteres de su id, en mayúsculas
export function referenciaPedido(id: string): string {
  return '#' + id.slice(-8).toUpperCase();
}

// Fecha y hora del pedido en formato español (p. ej. 02/11/26, 10:30)
export function formatearFechaPedido(fecha: string): string {
  return new Date(fecha).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
}

// Estados por los que se pueden filtrar los pedidos recibidos (PENDIENTE existe en la base de datos, pero la
// aplicación no lo usa)
export const ESTADOS_FILTRO = (Object.keys(ETIQUETA_ESTADO_PEDIDO) as EstadoPedido[]).filter(
  (estado) => estado !== 'PENDIENTE',
);

// Comprueba el estado que llega en la dirección de la página (?estado=...) antes de usarlo como filtro
export function esEstadoFiltrable(valor: string | null): valor is EstadoPedido {
  return valor !== null && (ESTADOS_FILTRO as string[]).includes(valor);
}

export function etiquetaEstadoPedido(estado: EstadoPedido): string {
  return ETIQUETA_ESTADO_PEDIDO[estado] ?? estado;
}

// Estado del envío: el vendedor puede indicar la fecha estimada de entrega al enviar el pedido
export const ESTADOS_CON_FECHA_ENTREGA: readonly EstadoPedido[] = ['ENVIADO', 'EN_REPARTO'];

// Hoy como AAAA-MM-DD en la hora del navegador (lo mínimo que se puede elegir como fecha de entrega)
export function diaDeHoy(ahora: Date = new Date()): string {
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}`;
}

// Procesar estado del pedido: lo que se pregunta antes de cambiarlo y el aviso al terminar
export function mensajeConfirmarCambioEstado(
  pedido: PedidoRecibido,
  nuevo: EstadoPedido,
  fechaEntregaEstimada: string | null = null,
): string {
  const entrega = fechaEntregaEstimada
    ? ` La entrega estimada será el ${formatearDia(fechaEntregaEstimada)}.`
    : '';
  return (
    `El pedido ${referenciaPedido(pedido.id)} pasará de «${etiquetaEstadoPedido(pedido.estado)}» ` +
    `a «${etiquetaEstadoPedido(nuevo)}».${entrega} Después no podrá volver a un estado anterior.`
  );
}

export function mensajeEstadoActualizado(estado: EstadoPedido): string {
  return `Estado actualizado: el pedido está ahora «${etiquetaEstadoPedido(estado)}».`;
}

// Texto de las unidades: «1 unidad», «3 unidades»
export function textoUnidades(unidades: number): string {
  return unidades === 1 ? '1 unidad' : `${unidades} unidades`;
}

// Mensajes para el vendedor. El 401 además lo gestiona el interceptor (vuelve al login).
export function mensajeErrorPedidosRecibidos(e: HttpErrorResponse): string {
  switch (e.status) {
    case 0:
      return 'No se puede conectar con el servidor. ¿Está arrancado el backend?';
    case 401:
      return 'Tu sesión ha caducado. Inicia sesión de nuevo.';
    case 403:
      return 'Solo los vendedores pueden consultar los pedidos recibidos.';
    default:
      return e.error?.mensaje ?? 'Ha ocurrido un error. Inténtalo de nuevo.';
  }
}

// Pedidos recibidos por el vendedor de la sesión. El backend solo devuelve los de sus productos.
// La cookie de sesión y el token CSRF (en el PATCH) los añade apiInterceptor.
@Injectable({ providedIn: 'root' })
export class PedidoVendedorService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_URL)}/api/vendedor/pedidos`;

  // Los más recientes primero (lista vacía si todavía no ha recibido ninguno)
  listar(): Observable<PedidoRecibido[]> {
    return this.http.get<PedidoRecibido[]>(this.url);
  }

  // 404 si el pedido no existe o es de otro vendedor
  obtener(id: string): Observable<PedidoRecibidoDetalle> {
    return this.http.get<PedidoRecibidoDetalle>(`${this.url}/${encodeURIComponent(id)}`);
  }

  // Procesar estado del pedido: lo hace avanzar y devuelve el detalle actualizado.
  // 409 si el cambio no se permite (hacia atrás o en un pedido terminado), con el mensaje del backend.
  // Estado del envío: al enviarlo se puede indicar la fecha estimada de entrega (AAAA-MM-DD).
  cambiarEstado(
    id: string,
    estado: EstadoPedido,
    fechaEntregaEstimada: string | null = null,
  ): Observable<PedidoRecibidoDetalle> {
    const cuerpo = fechaEntregaEstimada ? { estado, fechaEntregaEstimada } : { estado };
    return this.http.patch<PedidoRecibidoDetalle>(`${this.url}/${encodeURIComponent(id)}/estado`, cuerpo);
  }
}
