import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '../core/api';

export interface DireccionEnvio {
  calle: string;
  ciudad: string;
  codigoPostal: string;
}

export interface LineaPedido {
  idProducto: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  valoracion: number | null;
}

export interface Pedido {
  id: string;
  estado: string;
  fecha: string;
  precioTotal: number;
  direccionEnvio: DireccionEnvio;
  lineas: LineaPedido[];
}

export interface ResultadoPago {
  pedido: Pedido;
  ultimosDigitos: string;
}

// Pago del carrito (HU-23). El pago es ficticio: crea el pedido ya PAGADO. El token CSRF lo añade apiInterceptor.
@Injectable({ providedIn: 'root' })
export class PagoService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_URL)}/api/pago`;

  pagar(datos: { idMetodoPago: string; direccionEnvio: DireccionEnvio }): Observable<ResultadoPago> {
    return this.http.post<ResultadoPago>(this.url, datos);
  }
}