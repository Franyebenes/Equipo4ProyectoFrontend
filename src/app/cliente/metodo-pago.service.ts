import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '../core/api';

export interface MetodoPago {
  id: string;
  titular: string;
  ultimosDigitos: string;
  caducidad: string; // MM/AA
}

// Lo que se envía al añadir. El número y el CVV no se guardan en el servidor (solo los 4 últimos dígitos).
export interface NuevoMetodoPago {
  titular: string;
  numeroTarjeta: string;
  caducidad: string;
  cvv: string;
}

// Métodos de pago del cliente (HU-24.x). El token CSRF y la cookie de sesión los añade apiInterceptor.
@Injectable({ providedIn: 'root' })
export class MetodoPagoService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_URL)}/api/metodos-pago`;

  // HU-24.1
  listar(): Observable<MetodoPago[]> {
    return this.http.get<MetodoPago[]>(this.url);
  }

  // HU-24.2
  anadir(datos: NuevoMetodoPago): Observable<MetodoPago> {
    return this.http.post<MetodoPago>(this.url, datos);
  }

  // HU-24.3
  eliminar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}