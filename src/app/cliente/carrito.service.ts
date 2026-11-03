import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { API_URL } from '../core/api';

export interface LineaCarrito {
  idProducto: string;
  nombre: string;
  imagen: string | null;
  precioUnitario: number; // ya con el descuento aplicado
  precioOriginal: number; // precio base, para mostrarlo tachado
  cantidad: number;
  subtotal: number;
  disponible: boolean;
  idVendedor: string | null;
  nombreVendedor: string | null; // false si el vendedor lo ha desactivado (no cuenta en el total)
}

export interface Carrito {
  lineas: LineaCarrito[];
  numeroArticulos: number;
  total: number;
}

// Carrito del cliente (HU-22.x). El token CSRF y la cookie de sesión los añade apiInterceptor.
@Injectable({ providedIn: 'root' })
export class CarritoService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_URL)}/api/carrito`;

  /** Unidades que hay en el carrito, para el contador de la cabecera. */
  readonly numeroArticulos = signal(0);

  // HU-22.1
  obtener(): Observable<Carrito> {
    return this.http.get<Carrito>(this.url).pipe(tap((c) => this.numeroArticulos.set(c.numeroArticulos)));
  }

  // HU-22.2
  anadir(idProducto: string, cantidad = 1): Observable<void> {
    return this.http
      .post<void>(this.url, { idProducto, cantidad })
      .pipe(tap(() => this.numeroArticulos.update((n) => n + cantidad)));
  }

  // HU-22.3: devuelve el carrito ya actualizado
  cambiarCantidad(idProducto: string, cantidad: number): Observable<Carrito> {
    return this.http
      .put<Carrito>(`${this.url}/${idProducto}`, { cantidad })
      .pipe(tap((c) => this.numeroArticulos.set(c.numeroArticulos)));
  }

  // HU-22.4: devuelve el carrito ya actualizado
  eliminar(idProducto: string): Observable<Carrito> {
    return this.http
      .delete<Carrito>(`${this.url}/${idProducto}`)
      .pipe(tap((c) => this.numeroArticulos.set(c.numeroArticulos)));
  }
}