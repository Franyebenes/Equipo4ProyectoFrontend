import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '../core/api';

export interface Direccion {
  id: string;
  destinatario: string;
  calle: string;
  numero: string;
  pisoPuerta: string | null;
  codigoPostal: string;
  ciudad: string;
  provincia: string;
  predeterminada: boolean;
}

export type DatosDireccion = Omit<Direccion, 'id'>;

/** "Calle Mayor 5, 2B": la misma línea que el backend copia al pedido (Direccion.lineaCalle). */
export function lineaCalle(d: Pick<Direccion, 'calle' | 'numero' | 'pisoPuerta'>): string {
  return `${d.calle} ${d.numero}${d.pisoPuerta ? ', ' + d.pisoPuerta : ''}`;
}

@Injectable({ providedIn: 'root' })
export class DireccionService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_URL)}/api/cliente/direcciones`;

  listar(): Observable<Direccion[]> {
    return this.http.get<Direccion[]>(this.url);
  }

  obtener(id: string): Observable<Direccion> {
    return this.http.get<Direccion>(`${this.url}/${encodeURIComponent(id)}`);
  }

  crear(datos: DatosDireccion): Observable<Direccion> {
    return this.http.post<Direccion>(this.url, datos);
  }

  modificar(id: string, datos: DatosDireccion): Observable<Direccion> {
    return this.http.put<Direccion>(`${this.url}/${encodeURIComponent(id)}`, datos);
  }

  marcarPredeterminada(id: string): Observable<Direccion> {
    return this.http.patch<Direccion>(`${this.url}/${encodeURIComponent(id)}/predeterminada`, {});
  }

  eliminar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${encodeURIComponent(id)}`);
  }
}