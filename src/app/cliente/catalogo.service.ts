import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '../core/api';

// Disponibilidad que ve el cliente: nunca se recibe el stock exacto (POCO_STOCK = menos de 5 unidades)
export type Disponibilidad = 'DISPONIBLE' | 'POCO_STOCK' | 'AGOTADO';

// Producto del catálogo tal y como lo devuelve el backend (ProductoClienteDTO). precio es el precio sin
// descuentos; precioFinal, lo que paga este cliente (si es premium, ya con su descuento).
export interface ProductoCliente {
  id: string;
  nombre: string;
  imagen: string | null;
  categorias: string[];
  precio: number;
  precioFinal: number;
  soloPremium: boolean;
  disponibilidad: Disponibilidad;
}

// Una página de resultados (PaginaDTO del backend). pagina empieza en 0.
export interface Pagina<T> {
  contenido: T[];
  pagina: number;
  tamano: number;
  totalElementos: number;
  totalPaginas: number;
}

export const TEXTO_DISPONIBILIDAD: Record<Disponibilidad, string> = {
  DISPONIBLE: 'Disponible',
  POCO_STOCK: 'Queda poco stock',
  AGOTADO: 'Agotado',
};

// Con descuento se muestra el precio original tachado al lado del final
export function tieneDescuento(producto: ProductoCliente): boolean {
  return producto.precioFinal < producto.precio;
}

// Mensajes para el cliente. El 401 además lo gestiona el interceptor (vuelve al login).
export function mensajeErrorCatalogoCliente(e: HttpErrorResponse): string {
  switch (e.status) {
    case 0:
      return 'No se puede conectar con el servidor. Inténtalo de nuevo en unos minutos.';
    case 401:
      return 'Tu sesión ha caducado. Inicia sesión de nuevo.';
    case 403:
      return 'Solo los clientes pueden ver el catálogo.';
    default:
      return e.error?.mensaje ?? 'No se ha podido cargar el catálogo. Inténtalo de nuevo.';
  }
}

// HU-19 Catálogo del cliente: productos activos de todos los vendedores, de 12 en 12 y los más nuevos primero.
@Injectable({ providedIn: 'root' })
export class CatalogoService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_URL)}/api/catalogo`;

  // Búsqueda por nombre completo o parcial (sin distinguir mayúsculas ni tildes). Vacía, todo el catálogo.
  buscar(busqueda: string, pagina: number): Observable<Pagina<ProductoCliente>> {
    let params = new HttpParams().set('pagina', pagina);
    if (busqueda.trim()) {
      params = params.set('busqueda', busqueda.trim());
    }
    return this.http.get<Pagina<ProductoCliente>>(this.url, { params });
  }
}