import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { ParamMap } from '@angular/router';
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
  // Media de estrellas (de 1 a 5) o null si todavía no tiene valoraciones
  valoracionMedia: number | null;
  numeroValoraciones: number;
}

// HU-19 y HU-20: búsqueda y filtros del catálogo. Todos opcionales y combinables; vacíos, todo el catálogo.
// El precio es el que paga el cliente (con sus descuentos) y la valoración, la media mínima de estrellas.
export interface FiltrosCatalogo {
  busqueda: string;
  idCategoria: string;
  precioMinimo: number | null;
  precioMaximo: number | null;
  valoracionMinima: number | null;
  soloDisponibles: boolean;
}

export const FILTROS_VACIOS: FiltrosCatalogo = {
  busqueda: '',
  idCategoria: '',
  precioMinimo: null,
  precioMaximo: null,
  valoracionMinima: null,
  soloDisponibles: false,
};

// Valoraciones mínimas que se pueden elegir (de 1 a 5 estrellas, como en el backend)
export const VALORACIONES = [4, 3, 2, 1];
const VALORACION_MINIMA = 1;
const VALORACION_MAXIMA = 5;

// Mismas reglas que el backend: devuelve el motivo si los filtros no tienen sentido, o '' si se puede buscar
export function validarFiltros(filtros: FiltrosCatalogo): string {
  const { precioMinimo: minimo, precioMaximo: maximo, valoracionMinima: valoracion } = filtros;
  if ((minimo != null && minimo < 0) || (maximo != null && maximo < 0)) {
    return 'El precio no puede ser negativo.';
  }
  if (minimo != null && maximo != null && minimo > maximo) {
    return 'El precio mínimo no puede ser mayor que el máximo.';
  }
  if (valoracion != null && (valoracion < VALORACION_MINIMA || valoracion > VALORACION_MAXIMA)) {
    return 'La valoración debe estar entre 1 y 5 estrellas.';
  }
  return '';
}

// true si hay algún filtro aparte de la búsqueda por nombre
export function hayFiltros(filtros: FiltrosCatalogo): boolean {
  return (
    filtros.idCategoria !== '' ||
    filtros.precioMinimo != null ||
    filtros.precioMaximo != null ||
    filtros.valoracionMinima != null ||
    filtros.soloDisponibles
  );
}

const FORMATO_VALORACION = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function formatearValoracion(media: number): string {
  return FORMATO_VALORACION.format(media);
}

// Una página de resultados (PaginaDTO del backend). pagina empieza en 0.
export interface Pagina<T> {
  contenido: T[];
  pagina: number;
  tamano: number;
  totalElementos: number;
  totalPaginas: number;
}

// HU-21 Ficha del producto (ProductoDetalleDTO). descuento y descuentoPremium son porcentajes y pueden no existir.
// valoracionMedia es null mientras el producto no tenga valoraciones.
export interface ProductoDetalle {
  id: string;
  nombre: string;
  descripcion: string | null;
  imagen: string | null;
  categorias: string[];
  precio: number;
  precioFinal: number;
  descuento: number | null;
  descuentoPremium: number | null;
  soloPremium: boolean;
  disponibilidad: Disponibilidad;
  valoracionMedia: number | null;
  numeroValoraciones: number;
}

// Búsqueda, filtros y página del catálogo tal y como van en su dirección
// (?busqueda=…&categoria=…&precioMin=…&precioMax=…&valoracion=…&disponibles=true&pagina=2, la página empieza en 1)
export interface ParametrosCatalogo {
  busqueda?: string;
  categoria?: string;
  precioMin?: number;
  precioMax?: number;
  valoracion?: number;
  disponibles?: boolean;
  pagina?: number;
}

// Solo lo que tiene valor, para que la dirección quede limpia
export function filtrosAParametros(filtros: FiltrosCatalogo): ParametrosCatalogo {
  const parametros: ParametrosCatalogo = {};
  if (filtros.busqueda) {
    parametros.busqueda = filtros.busqueda;
  }
  if (filtros.idCategoria) {
    parametros.categoria = filtros.idCategoria;
  }
  if (filtros.precioMinimo != null) {
    parametros.precioMin = filtros.precioMinimo;
  }
  if (filtros.precioMaximo != null) {
    parametros.precioMax = filtros.precioMaximo;
  }
  if (filtros.valoracionMinima != null) {
    parametros.valoracion = filtros.valoracionMinima;
  }
  if (filtros.soloDisponibles) {
    parametros.disponibles = true;
  }
  return parametros;
}

// Al revés: los filtros que trae la dirección (un número que no lo es se ignora)
export function filtrosDeParametros(parametros: ParamMap): FiltrosCatalogo {
  return {
    busqueda: parametros.get('busqueda') ?? '',
    idCategoria: parametros.get('categoria') ?? '',
    precioMinimo: numeroDe(parametros.get('precioMin')),
    precioMaximo: numeroDe(parametros.get('precioMax')),
    valoracionMinima: numeroDe(parametros.get('valoracion')),
    soloDisponibles: parametros.get('disponibles') === 'true',
  };
}

function numeroDe(texto: string | null): number | null {
  const numero = texto == null || texto === '' ? NaN : Number(texto);
  return Number.isFinite(numero) ? numero : null;
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

  // Última búsqueda y página del catálogo: la ficha vuelve a ellas con «Volver al catálogo»
  readonly ultimosParametros = signal<ParametrosCatalogo>({});

  // Búsqueda por nombre (completo o parcial, sin distinguir mayúsculas ni tildes) y filtros. Solo se envía lo que
  // tiene valor.
  buscar(filtros: FiltrosCatalogo, pagina: number): Observable<Pagina<ProductoCliente>> {
    let params = new HttpParams().set('pagina', pagina);
    const busqueda = filtros.busqueda.trim();
    if (busqueda) {
      params = params.set('busqueda', busqueda);
    }
    if (filtros.idCategoria) {
      params = params.set('idCategoria', filtros.idCategoria);
    }
    if (filtros.precioMinimo != null) {
      params = params.set('precioMinimo', filtros.precioMinimo);
    }
    if (filtros.precioMaximo != null) {
      params = params.set('precioMaximo', filtros.precioMaximo);
    }
    if (filtros.valoracionMinima != null) {
      params = params.set('valoracionMinima', filtros.valoracionMinima);
    }
    if (filtros.soloDisponibles) {
      params = params.set('soloDisponibles', true);
    }
    return this.http.get<Pagina<ProductoCliente>>(this.url, { params });
  }

  // HU-21: siempre se pide al backend, así la ficha tiene los datos actuales del producto
  obtener(id: string): Observable<ProductoDetalle> {
    return this.http.get<ProductoDetalle>(`${this.url}/${encodeURIComponent(id)}`);
  }
}