import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, switchMap } from 'rxjs';

import { API_URL } from '../core/api';

// Producto tal y como lo devuelve el backend en el catálogo propio del vendedor (ProductoCatalogoDTO).
// precio es el precio base; los descuentos son porcentajes y pueden no existir. visible = producto activo.
export interface ProductoCatalogo {
  id: string;
  nombre: string;
  descripcion: string | null;
  imagen: string | null;
  categorias: string[];
  precio: number;
  descuento: number | null;
  descuentoPremium: number | null;
  stock: number;
  visible: boolean;
}

// HU15.1 - Datos para dar de alta un producto (ProductoAltaDTO en el backend).
export interface ProductoAlta {
  nombre: string;
  descripcion: string;
  precio: number;
  idCategorias: string[];
  stock: number;
  imagen: string | null;
}

// Token CSRF que devuelve /api/auth/csrf; el backend lo exige en las peticiones que modifican datos.
interface TokenCsrf {
  token: string;
  headerName: string;
}

const FORMATO_EUROS = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

export function formatearPrecio(precio: number): string {
  return FORMATO_EUROS.format(precio);
}

// Mensajes para el vendedor. El 401 además lo gestiona el interceptor (vuelve al login).
export function mensajeErrorCatalogo(e: HttpErrorResponse): string {
  switch (e.status) {
    case 0:
      return 'No se puede conectar con el servidor. ¿Está arrancado el backend?';
    case 401:
      return 'Tu sesión ha caducado. Inicia sesión de nuevo.';
    case 403:
      return 'Solo los vendedores pueden consultar su catálogo de productos.';
    default:
      return e.error?.mensaje ?? 'Ha ocurrido un error. Inténtalo de nuevo.';
  }
}

// Catálogo propio del vendedor de la sesión: el backend sabe quién es por la cookie de sesión.
@Injectable({ providedIn: 'root' })
export class ProductoService {
  private http = inject(HttpClient);
  private api = `${inject(API_URL)}/api/vendedor/productos`;
  private apiBase = inject(API_URL);

  listarMios(): Observable<ProductoCatalogo[]> {
    return this.http.get<ProductoCatalogo[]>(this.api);
  }

  obtenerMio(id: string): Observable<ProductoCatalogo> {
    return this.http.get<ProductoCatalogo>(`${this.api}/${id}`);
  }

  // HU15.1 - Pide el token CSRF y despues envia el alta con el en la cabecera.
  crear(datos: ProductoAlta): Observable<ProductoCatalogo> {
    return this.http.get<TokenCsrf>(`${this.apiBase}/api/auth/csrf`).pipe(
      switchMap((csrf) =>
        this.http.post<ProductoCatalogo>(this.api, datos, { headers: { [csrf.headerName]: csrf.token } }),
      ),
    );
  }
}
