import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, switchMap } from 'rxjs';
import { Categoria } from '../admin/categoria.service';

import { API_URL } from '../core/api';

// Producto tal y como lo devuelve el backend en el catálogo propio del vendedor (ProductoCatalogoDTO).
// precio es el precio base; los descuentos son porcentajes y pueden no existir. visible = producto activo.
// soloPremium = solo lo ven los clientes premium.
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
  soloPremium: boolean;
}

// HU15.1 - Datos para dar de alta un producto (ProductoAltaDTO en el backend).
// Modificar producto envía los mismos datos, que sustituyen a los guardados.
export interface ProductoAlta {
  nombre: string;
  descripcion: string;
  precio: number;
  idCategorias: string[];
  stock: number;
  imagen: string | null;
  // true = visible para los clientes (campo "visible" del producto)
  activo: boolean;
  // Porcentaje de descuento (0-100) o null si no tiene
  descuento: number | null;
  // Descuento adicional para clientes premium (0-100), o null si no tiene
  descuentoPremium: number | null;
  // true = solo lo ven los clientes premium
  soloPremium: boolean;
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

// Máximo de unidades en stock (el mismo límite que el backend)
export const STOCK_MAXIMO = 1_000_000;

// Tipo de imagen según cómo empieza su base64 (la firma del fichero)
const FIRMAS_IMAGEN: [string, string][] = [
  ['/9j/', 'image/jpeg'],
  ['iVBOR', 'image/png'],
  ['UklGR', 'image/webp'],
];

// Imagen lista para un <img>. El formulario la guarda como data URL, pero puede haber productos
// con la imagen solo en base64, sin el prefijo «data:» (el carrito también los admite): se les
// añade el prefijo con su tipo. Al guardar el producto desde el formulario ya queda bien guardada.
export function urlImagen(imagen: string | null): string | null {
  if (!imagen) {
    return null;
  }
  if (/^(data|https?):/.test(imagen)) {
    return imagen;
  }
  const tipo = FIRMAS_IMAGEN.find(([firma]) => imagen.startsWith(firma))?.[1] ?? 'image/png';
  return `data:${tipo};base64,${imagen}`;
}

const FORMATO_EUROS = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

export function formatearPrecio(precio: number): string {
  return FORMATO_EUROS.format(precio);
}

// Precio que pagan los clientes con un descuento en porcentaje
export function formatearPrecioConDescuento(precio: number, descuento: number): string {
  return formatearPrecio(precio * (1 - descuento / 100));
}

// Precio que paga el cliente: el mismo cálculo que PrecioProducto.precioFinal en el backend. Todos
// tienen el descuento para todos y un premium, además, el premium: los dos se suman
// (10 % + 15 % = 25 %). Redondeado a céntimos y nunca negativo.
export function precioFinal(
  precio: number,
  descuento: number | null,
  descuentoPremium: number | null,
  clientePremium: boolean,
): number {
  const total = descuentoTotal(descuento, clientePremium ? descuentoPremium : null);
  const resultado = precio * Math.max(0, 1 - total / 100);
  return Math.round(resultado * 100) / 100;
}

// Descuento total en porcentaje: el general más el premium (0 si no hay ninguno)
export function descuentoTotal(descuento: number | null, descuentoPremium: number | null): number {
  return (descuento ?? 0) + (descuentoPremium ?? 0);
}

const FORMATO_PORCENTAJE = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });

// « (25 % en total)» si el producto tiene los dos descuentos, para que se vea que se suman; si no, ''
export function textoDescuentoTotal(
  descuento: number | null,
  descuentoPremium: number | null,
): string {
  if (!descuento || !descuentoPremium) {
    return '';
  }
  return ` (${FORMATO_PORCENTAJE.format(descuentoTotal(descuento, descuentoPremium))} % en total)`;
}

// Precio que pagan los clientes premium, con los dos descuentos sumados
export function formatearPrecioPremium(producto: ProductoCatalogo): string {
  return formatearPrecio(precioFinal(producto.precio, producto.descuento, producto.descuentoPremium, true));
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
  if (stock > STOCK_MAXIMO) {
    return 'El stock no puede superar 1.000.000 unidades.';
  }
  return '';
}

// Si el backend responde 409 porque el stock cambió mientras se editaba (p. ej. un cliente reservó
// unidades), devuelve la cantidad actual que envía; si el error es otro, null.
export function stockActualDelConflicto(e: HttpErrorResponse): number | null {
  const stockActual = e.status === 409 ? e.error?.stockActual : null;
  return typeof stockActual === 'number' ? stockActual : null;
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

// Confirmación tras dar de alta un producto; si se creó inactivo, recuerda que no lo ven
export function mensajeProductoCreado(producto: ProductoCatalogo): string {
  if (producto.visible) {
    return `«${producto.nombre}» se ha añadido a tu catálogo.`;
  }
  return (
    `«${producto.nombre}» se ha añadido a tu catálogo como inactivo: ` +
    'los clientes no lo verán hasta que lo actives.'
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

  // Modificar producto: sustituye los datos editables y devuelve el producto actualizado.
  // stockAnterior es el stock que se cargó en el formulario: si ha cambiado, el backend no lo pisa.
  modificar(id: string, datos: ProductoAlta, stockAnterior: number): Observable<ProductoCatalogo> {
    return this.conCsrf((cabeceras) =>
      this.http.put<ProductoCatalogo>(`${this.api}/${id}`, datos, {
        headers: cabeceras,
        params: { stockAnterior },
      }),
    );
  }

  // Activar/Desactivar producto: devuelve el producto con su estado nuevo
  cambiarEstado(id: string, activo: boolean): Observable<ProductoCatalogo> {
    return this.conCsrf((cabeceras) =>
      this.http.patch<ProductoCatalogo>(`${this.api}/${id}/estado`, { activo }, { headers: cabeceras }),
    );
  }

  // Gestión de stock: fija las unidades disponibles y devuelve el producto actualizado.
  // stockAnterior es la cantidad que estaba viendo el vendedor: si ha cambiado, el backend responde 409.
  cambiarStock(id: string, stock: number, stockAnterior: number): Observable<ProductoCatalogo> {
    return this.conCsrf((cabeceras) =>
      this.http.patch<ProductoCatalogo>(
        `${this.api}/${id}/stock`,
        { stock },
        { headers: cabeceras, params: { stockAnterior } },
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
