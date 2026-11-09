import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '../core/api';

export interface ListaResumen {
  id: string;
  nombre: string;
  porDefecto: boolean;
  idProductos: string[];
  /** Imágenes de los últimos productos guardados (mosaico de la colección); solo vienen al listar. */
  portadas: string[];
}

export interface ProductoEnLista {
  id: string;
  nombre: string;
  imagen: string | null;
  precio: number | null;
  disponible: boolean;
}

export interface ListaDetalle {
  id: string;
  nombre: string;
  porDefecto: boolean;
  productos: ProductoEnLista[];
}

/** Letras, números y espacios, como Constantes.PATRON_NOMBRE; máximo 40 caracteres. */
export function nombreDeListaValido(nombre: string): boolean {
  return nombre.length <= 40 && /^[\p{L}\d ]+$/u.test(nombre);
}

const e = encodeURIComponent;

@Injectable({ providedIn: 'root' })
export class ListasService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_URL)}/api/cliente/listas`;

  listar(): Observable<ListaResumen[]> {
    return this.http.get<ListaResumen[]>(this.url);
  }

  obtener(id: string): Observable<ListaDetalle> {
    return this.http.get<ListaDetalle>(`${this.url}/${e(id)}`);
  }

  crear(nombre: string): Observable<ListaResumen> {
    return this.http.post<ListaResumen>(this.url, { nombre });
  }

  renombrar(id: string, nombre: string): Observable<ListaResumen> {
    return this.http.put<ListaResumen>(`${this.url}/${e(id)}`, { nombre });
  }

  eliminar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${e(id)}`);
  }

  anadirProducto(idLista: string, idProducto: string): Observable<ListaResumen> {
    return this.http.put<ListaResumen>(`${this.url}/${e(idLista)}/productos/${e(idProducto)}`, {});
  }

  quitarProducto(idLista: string, idProducto: string): Observable<ListaResumen> {
    return this.http.delete<ListaResumen>(`${this.url}/${e(idLista)}/productos/${e(idProducto)}`);
  }
}