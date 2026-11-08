import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { API_URL } from '../core/api';
import { ProductoCliente } from './catalogo.service';

// Mensajes para el cliente si falla añadir o quitar un favorito. El 401 además lo gestiona el interceptor.
export function mensajeErrorFavoritos(e: HttpErrorResponse): string {
  switch (e.status) {
    case 0:
      return 'No se puede conectar con el servidor. Inténtalo de nuevo.';
    case 401:
      return 'Inicia sesión para guardar tus favoritos.';
    default:
      return e.error?.mensaje ?? 'No se ha podido actualizar tus favoritos. Inténtalo de nuevo.';
  }
}

// HU-31 Favoritos del cliente. Se guardan en el backend, así que se conservan entre sesiones. «ids» son los productos
// marcados, para pintar el corazón relleno en el catálogo, la ficha y la lista. El token CSRF lo añade apiInterceptor.
@Injectable({ providedIn: 'root' })
export class FavoritosService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_URL)}/api/favoritos`;

  private readonly _ids = signal<ReadonlySet<string>>(new Set());
  readonly ids = this._ids.asReadonly();

  // Se pide al entrar en el catálogo, la ficha o la lista, para tener siempre los favoritos actuales
  cargarIds(): void {
    this.http.get<string[]>(`${this.url}/ids`).subscribe({
      next: (ids) => this._ids.set(new Set(ids)),
      error: () => this._ids.set(new Set()),
    });
  }

  // HU-31.1: con la misma información que el catálogo, los últimos añadidos primero
  listar(): Observable<ProductoCliente[]> {
    return this.http.get<ProductoCliente[]>(this.url);
  }

  // HU-31.2
  anadir(idProducto: string): Observable<void> {
    return this.http
      .post<void>(`${this.url}/${encodeURIComponent(idProducto)}`, null)
      .pipe(tap(() => this._ids.update((ids) => new Set(ids).add(idProducto))));
  }

  // HU-31.3
  quitar(idProducto: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${encodeURIComponent(idProducto)}`).pipe(
      tap(() =>
        this._ids.update((ids) => {
          const nuevos = new Set(ids);
          nuevos.delete(idProducto);
          return nuevos;
        }),
      ),
    );
  }
}