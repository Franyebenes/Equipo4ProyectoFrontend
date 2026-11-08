import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '../core/api';

export interface ProductoAdmin {
  id: string;
  nombre: string;
  vendedor: string;
  categorias: string[];
  precio: number | null;
  stock: number;
  visible: boolean;
  soloPremium: boolean;
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

  listar(pagina: number, tamano = 20): Observable<Pagina<ProductoAdmin>> {
    const params = new HttpParams().set('pagina', pagina).set('tamano', tamano);
    return this.http.get<Pagina<ProductoAdmin>>(this.url, { params });
  }
}