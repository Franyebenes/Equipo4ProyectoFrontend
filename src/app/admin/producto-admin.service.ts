import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '../core/api';
import { FiltrosCatalogo } from '../cliente/catalogo.service';

export interface ProductoAdmin {
  id: string;
  nombre: string;
  imagen: string | null;
  vendedor: string;
  categorias: string[];
  /** Precio sin descuentos */
  precio: number | null;
  /** Lo que paga un cliente estándar */
  precioFinal: number | null;
  stock: number;
  visible: boolean;
  soloPremium: boolean;
  valoracionMedia: number | null;
  numeroValoraciones: number;
}

/** Ficha de un producto en modo lectura (ProductoAdminDetalleDTO). */
export interface ProductoAdminDetalle {
  id: string;
  nombre: string;
  descripcion: string | null;
  imagen: string | null;
  vendedor: string;
  categorias: string[];
  precio: number | null;
  precioFinal: number | null;
  precioPremium: number | null;
  descuento: number | null;
  descuentoPremium: number | null;
  stock: number;
  visible: boolean;
  soloPremium: boolean;
  valoracionMedia: number | null;
  numeroValoraciones: number;
}

/** Mismo formato que PaginaDTO del backend */
export interface Pagina<T> {
  contenido: T[];
  pagina: number;
  tamano: number;
  totalElementos: number;
  totalPaginas: number;
}

@Injectable({ providedIn: 'root' })
export class ProductoAdminService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_URL)}/api/admin/productos`;

  /** Último listado visto: al volver de una ficha se recuperan sus filtros y su página. */
  ultimoListado: { filtros: FiltrosCatalogo; pagina: number } | null = null;

  obtener(id: string): Observable<ProductoAdminDetalle> {
    return this.http.get<ProductoAdminDetalle>(`${this.url}/${encodeURIComponent(id)}`);
  }

  /** Solo se envían los filtros que tienen valor. */
  listar(filtros: FiltrosCatalogo, pagina: number, tamano = 12): Observable<Pagina<ProductoAdmin>> {
    let params = new HttpParams().set('pagina', pagina).set('tamano', tamano);
    const conValor = { ...filtros, busqueda: filtros.busqueda.trim(), soloDisponibles: filtros.soloDisponibles || null };
    for (const [nombre, valor] of Object.entries(conValor)) {
      if (valor !== null && valor !== '') {
        params = params.set(nombre, valor);
      }
    }
    return this.http.get<Pagina<ProductoAdmin>>(this.url, { params });
  }
}
