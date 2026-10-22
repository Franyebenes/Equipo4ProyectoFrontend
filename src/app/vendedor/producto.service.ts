import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, switchMap } from 'rxjs';
import { Categoria } from '../admin/categoria.service';

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

// Modificar producto - Datos que el vendedor puede editar (ProductoModificacionDTO en el backend).
// Sustituyen a los guardados. El stock y el estado no van aquí: se cambian desde la ficha del producto.
export interface ProductoModificacion {
  nombre: string;
  descripcion: string;
  precio: number;
  idCategorias: string[];
  imagen: string | null;
  // Porcentaje de descuento (0-100) o null si no tiene
  descuento: number | null;
}

// HU15.1 - Datos para dar de alta un producto (ProductoAltaDTO en el backend): los editables, el stock
// y el estado.
export interface ProductoAlta extends ProductoModificacion {
  stock: number;
  // true = visible para los clientes (campo "visible" del producto)
  activo: boolean;
}

// Criterios con los que el backend filtra el catálogo propio. Se combinan entre sí; los vacíos no se envían.
export interface FiltroCatalogo {
  // Nombre completo o parcial del producto
  busqueda?: string;
  idCategoria?: string;
  // true solo los activos, false solo los inactivos, null todos
  activo?: boolean | null;
  // Rango de precio base, con los límites incluidos
  precioMinimo?: number | null;
  precioMaximo?: number | null;
}

// Token CSRF que devuelve /api/auth/csrf; el backend lo exige en las peticiones que modifican datos.
interface TokenCsrf {
  token: string;
  headerName: string;
}

// Imagen que se muestra cuando el producto no tiene foto (está en public/)
export const IMAGEN_POR_DEFECTO = '/producto-sin-imagen.svg';

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
      return 'Solo los vendedores pueden gestionar su catálogo de productos.';
    default:
      return e.error?.mensaje ?? 'Ha ocurrido un error. Inténtalo de nuevo.';
  }
}

// Confirmación tras activar o desactivar un producto
export function mensajeEstadoCambiado(producto: ProductoCatalogo): string {
  return producto.visible
    ? `«${producto.nombre}» está activo: vuelve a estar visible y disponible para los clientes.`
    : `«${producto.nombre}» está inactivo: los clientes ya no pueden verlo ni comprarlo.`;
}

// Unidades disponibles en texto: «Sin stock», «1 unidad», «12 unidades»
export function textoStock(stock: number): string {
  if (stock === 0) {
    return 'Sin stock';
  }
  return stock === 1 ? '1 unidad' : `${stock} unidades`;
}

// Comprueba la cantidad antes de enviarla (mismas reglas que el backend).
// Devuelve el error o '' si es válida.
export function validarStock(stock: number | null): string {
  if (stock == null) {
    return 'Indica la cantidad de stock.';
  }
  if (!Number.isInteger(stock) || stock < 0) {
    return 'El stock debe ser un número entero no negativo.';
  }
  return '';
}

// Confirmación tras guardar el stock; con 0 avisa de que el producto deja de estar a la venta
export function mensajeStockActualizado(producto: ProductoCatalogo): string {
  if (producto.stock === 0) {
    return (
      `Stock de «${producto.nombre}» actualizado: sin stock. ` +
      'No está disponible para la venta hasta que repongas unidades.'
    );
  }
  return `Stock de «${producto.nombre}» actualizado: ${textoStock(producto.stock)}.`;
}

// Texto del diálogo que pide confirmación antes de eliminar
export function mensajeConfirmarEliminacion(producto: ProductoCatalogo): string {
  return (
    `¿Seguro que quieres eliminar «${producto.nombre}» de tu catálogo? ` +
    'Se borrará definitivamente y los clientes dejarán de verlo. Esta acción no se puede deshacer.'
  );
}

export function mensajeProductoEliminado(producto: ProductoCatalogo): string {
  return `«${producto.nombre}» se ha eliminado de tu catálogo.`;
}

// Confirmación tras guardar los cambios de un producto
export function mensajeProductoModificado(producto: ProductoCatalogo): string {
  return `Cambios guardados: «${producto.nombre}» se ha actualizado en tu catálogo.`;
}

// El producto trae sus categorías por nombre y el formulario las marca por id. Los nombres de las
// categorías son únicos, así que se pueden traducir. Las que ya no existen no se marcan.
export function idsDeCategorias(nombres: string[], categorias: Categoria[]): string[] {
  return categorias.filter((c) => nombres.includes(c.nombre)).map((c) => c.id);
}

// Catálogo propio del vendedor de la sesión: el backend sabe quién es por la cookie de sesión.
@Injectable({ providedIn: 'root' })
export class ProductoService {
  private http = inject(HttpClient);
  private api = `${inject(API_URL)}/api/vendedor/productos`;
  private apiBase = inject(API_URL);

  listarMios(filtro: FiltroCatalogo = {}): Observable<ProductoCatalogo[]> {
    const valores = {
      busqueda: filtro.busqueda?.trim(),
      idCategoria: filtro.idCategoria,
      activo: filtro.activo,
      precioMinimo: filtro.precioMinimo,
      precioMaximo: filtro.precioMaximo,
    };
    let params = new HttpParams();
    for (const [nombre, valor] of Object.entries(valores)) {
      // false y 0 son filtros válidos: solo se descartan los vacíos
      if (valor !== undefined && valor !== null && valor !== '') {
        params = params.set(nombre, valor);
      }
    }
    return this.http.get<ProductoCatalogo[]>(this.api, { params });
  }

  obtenerMio(id: string): Observable<ProductoCatalogo> {
    return this.http.get<ProductoCatalogo>(`${this.api}/${id}`);
  }

  listarCategorias(): Observable<Categoria[]> {
    return this.http.get<Categoria[]>(`${this.apiBase}/api/registro/categorias`);
  }

  // HU15.1 - Alta de producto
  crear(datos: ProductoAlta): Observable<ProductoCatalogo> {
    return this.conCsrf((cabeceras) => this.http.post<ProductoCatalogo>(this.api, datos, { headers: cabeceras }));
  }

  // Modificar producto: sustituye los datos editables y devuelve el producto actualizado
  modificar(id: string, datos: ProductoModificacion): Observable<ProductoCatalogo> {
    return this.conCsrf((cabeceras) =>
      this.http.put<ProductoCatalogo>(`${this.api}/${id}`, datos, { headers: cabeceras }),
    );
  }

  // Activar/Desactivar producto: devuelve el producto con su estado nuevo
  cambiarEstado(id: string, activo: boolean): Observable<ProductoCatalogo> {
    return this.conCsrf((cabeceras) =>
      this.http.patch<ProductoCatalogo>(`${this.api}/${id}/estado`, { activo }, { headers: cabeceras }),
    );
  }

  // Gestión de stock: fija las unidades disponibles y devuelve el producto actualizado
  cambiarStock(id: string, stock: number): Observable<ProductoCatalogo> {
    return this.conCsrf((cabeceras) =>
      this.http.patch<ProductoCatalogo>(
        `${this.api}/${id}/stock`,
        { stock },
        { headers: cabeceras },
      ),
    );
  }

  // Eliminar producto: lo borra definitivamente (el backend responde 204, sin cuerpo)
  eliminar(id: string): Observable<void> {
    return this.conCsrf((cabeceras) =>
      this.http.delete<void>(`${this.api}/${id}`, { headers: cabeceras }),
    );
  }

  // Las peticiones que modifican datos llevan el token CSRF: se pide y se envía en la cabecera que indica el backend
  private conCsrf<T>(peticion: (cabeceras: Record<string, string>) => Observable<T>): Observable<T> {
    return this.http
      .get<TokenCsrf>(`${this.apiBase}/api/auth/csrf`)
      .pipe(switchMap((csrf) => peticion({ [csrf.headerName]: csrf.token })));
  }
}
