import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Categoria } from '../admin/categoria.service';
import {
  ProductoAlta,
  ProductoCatalogo,
  ProductoService,
  STOCK_MAXIMO,
  descuentoTotal,
  formatearPrecioConDescuento,
  idsDeCategorias,
  mensajeConfirmarEliminacion,
  mensajeEstadoCambiado,
  mensajeProductoCreado,
  mensajeProductoEliminado,
  mensajeProductoModificado,
  mensajeStockActualizado,
  precioFinal,
  stockActualDelConflicto,
  textoDescuentoTotal,
  textoStock,
  urlImagen,
  validarStock,
} from './producto.service';

const URL_CATALOGO = 'http://localhost:8080/api/vendedor/productos';
const URL_CSRF = 'http://localhost:8080/api/auth/csrf';

describe('ProductoService.listarMios', () => {
  let servicio: ProductoService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(ProductoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sin filtros pide todo el catálogo, sin parámetros', () => {
    servicio.listarMios().subscribe();

    const peticion = http.expectOne((r) => r.url === URL_CATALOGO);
    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.params.keys()).toEqual([]);
    peticion.flush([]);
  });

  it('envía la búsqueda sin los espacios de los extremos', () => {
    servicio.listarMios({ busqueda: '  lámpara ' }).subscribe();

    const peticion = http.expectOne((r) => r.url === URL_CATALOGO);
    expect(peticion.request.params.get('busqueda')).toBe('lámpara');
    peticion.flush([]);
  });

  it('no envía una búsqueda vacía o de solo espacios', () => {
    servicio.listarMios({ busqueda: '   ' }).subscribe();

    const peticion = http.expectOne((r) => r.url === URL_CATALOGO);
    expect(peticion.request.params.has('busqueda')).toBe(false);
    peticion.flush([]);
  });

  it('envía todos los filtros juntos, incluidos false y 0, que son filtros válidos', () => {
    servicio
      .listarMios({ busqueda: 'bolso', idCategoria: 'c1', activo: false, precioMinimo: 0, precioMaximo: 50.5 })
      .subscribe();

    const peticion = http.expectOne((r) => r.url === URL_CATALOGO);
    const params = peticion.request.params;
    expect(params.get('busqueda')).toBe('bolso');
    expect(params.get('idCategoria')).toBe('c1');
    expect(params.get('activo')).toBe('false');
    expect(params.get('precioMinimo')).toBe('0');
    expect(params.get('precioMaximo')).toBe('50.5');
    peticion.flush([]);
  });

  it('no envía los filtros vacíos (categoría, estado o precios sin elegir)', () => {
    servicio.listarMios({ idCategoria: '', activo: null, precioMinimo: null, precioMaximo: undefined }).subscribe();

    const peticion = http.expectOne((r) => r.url === URL_CATALOGO);
    expect(peticion.request.params.keys()).toEqual([]);
    peticion.flush([]);
  });
});

describe('ProductoService (peticiones que modifican datos)', () => {
  let servicio: ProductoService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(ProductoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('cambiarEstado pide el token CSRF y envía un PATCH con el estado nuevo', () => {
    let respuesta: ProductoCatalogo | undefined;
    servicio.cambiarEstado('p1', false).subscribe({ next: (producto) => (respuesta = producto) });

    http.expectOne(URL_CSRF).flush({ token: 'token-1', headerName: 'X-XSRF-TOKEN' });
    const peticion = http.expectOne(`${URL_CATALOGO}/p1/estado`);
    expect(peticion.request.method).toBe('PATCH');
    expect(peticion.request.headers.get('X-XSRF-TOKEN')).toBe('token-1');
    expect(peticion.request.body).toEqual({ activo: false });
    peticion.flush({ id: 'p1', nombre: 'Lámpara', visible: false });
    expect(respuesta?.visible).toBe(false);
  });

  it('cambiarStock pide el token CSRF y envía un PATCH con la cantidad nueva y la que se veía', () => {
    let respuesta: ProductoCatalogo | undefined;
    servicio.cambiarStock('p1', 12, 4).subscribe({ next: (producto) => (respuesta = producto) });

    http.expectOne(URL_CSRF).flush({ token: 'token-3', headerName: 'X-XSRF-TOKEN' });
    const peticion = http.expectOne((r) => r.url === `${URL_CATALOGO}/p1/stock`);
    expect(peticion.request.method).toBe('PATCH');
    expect(peticion.request.params.get('stockAnterior')).toBe('4');
    expect(peticion.request.headers.get('X-XSRF-TOKEN')).toBe('token-3');
    expect(peticion.request.body).toEqual({ stock: 12 });
    peticion.flush({ id: 'p1', nombre: 'Lámpara', stock: 12 });
    expect(respuesta?.stock).toBe(12);
  });

  it('eliminar pide el token CSRF y envía un DELETE del producto', () => {
    let terminado = false;
    servicio.eliminar('p1').subscribe({ next: () => (terminado = true) });

    http.expectOne(URL_CSRF).flush({ token: 'token-4', headerName: 'X-XSRF-TOKEN' });
    const peticion = http.expectOne(`${URL_CATALOGO}/p1`);
    expect(peticion.request.method).toBe('DELETE');
    expect(peticion.request.headers.get('X-XSRF-TOKEN')).toBe('token-4');
    peticion.flush(null, { status: 204, statusText: 'No Content' });
    expect(terminado).toBe(true);
  });

  it('modificar pide el token CSRF y envía un PUT con los datos nuevos del producto', () => {
    const cambios: ProductoAlta = {
      nombre: 'Lámpara LED', descripcion: 'Luz cálida', precio: 95.5, idCategorias: ['c1', 'c2'],
      stock: 12, imagen: null, activo: false, descuento: 20, descuentoPremium: 5, soloPremium: true,
    };
    let respuesta: ProductoCatalogo | undefined;
    servicio.modificar('p1', cambios, 4).subscribe({ next: (producto) => (respuesta = producto) });

    http.expectOne(URL_CSRF).flush({ token: 'token-5', headerName: 'X-XSRF-TOKEN' });
    const peticion = http.expectOne((r) => r.url === `${URL_CATALOGO}/p1`);
    expect(peticion.request.method).toBe('PUT');
    expect(peticion.request.params.get('stockAnterior')).toBe('4');
    expect(peticion.request.headers.get('X-XSRF-TOKEN')).toBe('token-5');
    expect(peticion.request.body).toEqual(cambios);
    peticion.flush({ id: 'p1', nombre: 'Lámpara LED', precio: 95.5 });
    expect(respuesta?.nombre).toBe('Lámpara LED');
  });

  it('crear también envía el token CSRF', () => {
    const alta: ProductoAlta = {
      nombre: 'Lámpara', descripcion: 'De pie', precio: 80, idCategorias: ['c1'], stock: 4,
      imagen: null, activo: true, descuento: null, descuentoPremium: null, soloPremium: false,
    };
    servicio.crear(alta).subscribe();

    http.expectOne(URL_CSRF).flush({ token: 'token-2', headerName: 'X-XSRF-TOKEN' });
    const peticion = http.expectOne(URL_CATALOGO);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.headers.get('X-XSRF-TOKEN')).toBe('token-2');
    expect(peticion.request.body).toEqual(alta);
    peticion.flush({});
  });
});

describe('mensajeEstadoCambiado', () => {
  const producto = (visible: boolean) => ({ nombre: 'Lámpara', visible }) as ProductoCatalogo;

  it('confirma que el producto vuelve a estar a la venta', () => {
    expect(mensajeEstadoCambiado(producto(true))).toBe(
      '«Lámpara» está activo: vuelve a estar visible y disponible para los clientes.',
    );
  });

  it('confirma que el producto deja de estar a la venta', () => {
    expect(mensajeEstadoCambiado(producto(false))).toBe(
      '«Lámpara» está inactivo: los clientes ya no pueden verlo ni comprarlo.',
    );
  });
});

describe('Gestión de stock: textos y validación', () => {
  it('textoStock muestra la cantidad en singular, plural o «Sin stock»', () => {
    expect(textoStock(0)).toBe('Sin stock');
    expect(textoStock(1)).toBe('1 unidad');
    expect(textoStock(12)).toBe('12 unidades');
  });

  it('validarStock acepta enteros no negativos', () => {
    expect(validarStock(0)).toBe('');
    expect(validarStock(25)).toBe('');
  });

  it('validarStock acepta hasta el máximo y rechaza más unidades', () => {
    expect(validarStock(STOCK_MAXIMO)).toBe('');
    expect(validarStock(STOCK_MAXIMO + 1)).toBe('El stock no puede superar 1.000.000 unidades.');
  });

  it('stockActualDelConflicto da la cantidad actual solo si el stock cambió mientras se editaba', () => {
    const error = (status: number, cuerpo: unknown) => ({ status, error: cuerpo }) as HttpErrorResponse;
    const conflicto = error(409, { mensaje: 'El stock ha cambiado…', stockActual: 3 });
    expect(stockActualDelConflicto(conflicto)).toBe(3);
    expect(stockActualDelConflicto(error(409, { mensaje: 'Otro conflicto' }))).toBe(null);
    expect(stockActualDelConflicto(error(400, { stockActual: 3 }))).toBe(null);
  });

  it('validarStock rechaza la cantidad vacía, negativa o con decimales', () => {
    expect(validarStock(null)).toBe('Indica la cantidad de stock.');
    expect(validarStock(-1)).toBe('El stock debe ser un número entero no negativo.');
    expect(validarStock(2.5)).toBe('El stock debe ser un número entero no negativo.');
  });

  it('mensajeStockActualizado avisa de que sin stock no se puede vender', () => {
    const producto = (stock: number) => ({ nombre: 'Lámpara', stock }) as ProductoCatalogo;
    expect(mensajeStockActualizado(producto(3))).toBe('Stock de «Lámpara» actualizado: 3 unidades.');
    expect(mensajeStockActualizado(producto(0))).toBe(
      'Stock de «Lámpara» actualizado: sin stock. ' +
        'No está disponible para la venta hasta que repongas unidades.',
    );
  });
});

describe('Eliminar producto: textos', () => {
  const producto = { nombre: 'Lámpara' } as ProductoCatalogo;

  it('la confirmación nombra el producto y avisa de que no se puede deshacer', () => {
    const mensaje = mensajeConfirmarEliminacion(producto);
    expect(mensaje).toContain('«Lámpara»');
    expect(mensaje).toContain('no se puede deshacer');
  });

  it('confirma la eliminación nombrando el producto', () => {
    expect(mensajeProductoEliminado(producto)).toBe('«Lámpara» se ha eliminado de tu catálogo.');
  });
});

describe('Modificar producto: textos y categorías', () => {
  it('confirma los cambios nombrando el producto', () => {
    expect(mensajeProductoModificado({ nombre: 'Lámpara LED' } as ProductoCatalogo)).toBe(
      'Cambios guardados: «Lámpara LED» se ha actualizado en tu catálogo.',
    );
  });

  it('idsDeCategorias marca las categorías del producto por su nombre', () => {
    const categorias: Categoria[] = [
      { id: 'c1', nombre: 'Hogar', descripcion: '' },
      { id: 'c2', nombre: 'Iluminación', descripcion: '' },
      { id: 'c3', nombre: 'Moda', descripcion: '' },
    ];
    expect(idsDeCategorias(['Iluminación', 'Hogar'], categorias)).toEqual(['c1', 'c2']);
    // Una categoría que ya no existe no se marca
    expect(idsDeCategorias(['Borrada'], categorias)).toEqual([]);
  });
});

describe('formatearPrecioConDescuento', () => {
  it('aplica el porcentaje al precio base', () => {
    // Intl separa los euros con un espacio duro antes del símbolo
    expect(formatearPrecioConDescuento(95.5, 20).replace(/\s/g, ' ')).toBe('76,40 €');
    expect(formatearPrecioConDescuento(80, 0).replace(/\s/g, ' ')).toBe('80,00 €');
  });
});

describe('Alta de producto: confirmación', () => {
  it('confirma el alta nombrando el producto', () => {
    const producto = { nombre: 'Lámpara', visible: true } as ProductoCatalogo;
    expect(mensajeProductoCreado(producto)).toBe('«Lámpara» se ha añadido a tu catálogo.');
  });

  it('si se creó inactivo, recuerda que los clientes no lo ven', () => {
    const producto = { nombre: 'Lámpara', visible: false } as ProductoCatalogo;
    expect(mensajeProductoCreado(producto)).toBe(
      '«Lámpara» se ha añadido a tu catálogo como inactivo: ' +
        'los clientes no lo verán hasta que lo actives.',
    );
  });
});

describe('urlImagen', () => {
  it('deja igual las imágenes que ya son una data URL o una dirección web', () => {
    const dataUrl = 'data:image/webp;base64,UklGRhYAAABXRUJQ';
    expect(urlImagen(dataUrl)).toBe(dataUrl);
    expect(urlImagen('https://ejemplo.com/foto.png')).toBe('https://ejemplo.com/foto.png');
  });

  it('añade el prefijo con su tipo a las guardadas solo en base64', () => {
    expect(urlImagen('/9j/4AAQSkZJRg==')).toBe('data:image/jpeg;base64,/9j/4AAQSkZJRg==');
    expect(urlImagen('iVBORw0KGgo=')).toBe('data:image/png;base64,iVBORw0KGgo=');
    expect(urlImagen('UklGRhYAAABXRUJQ')).toBe('data:image/webp;base64,UklGRhYAAABXRUJQ');
    // Si no se reconoce el tipo, como el carrito: PNG
    expect(urlImagen('AAAA')).toBe('data:image/png;base64,AAAA');
  });

  it('sin imagen devuelve null (se muestra la imagen por defecto)', () => {
    expect(urlImagen(null)).toBe(null);
    expect(urlImagen('')).toBe(null);
  });
});

describe('Descuento premium: se suma al descuento para todos', () => {
  it('precioFinal: el premium tiene los dos descuentos sumados y el resto solo el general', () => {
    // El ejemplo de la HU: 10 % para todos y 15 % extra para premium = 25 %
    expect(precioFinal(100, 10, 15, false)).toBe(90);
    expect(precioFinal(100, 10, 15, true)).toBe(75);
    expect(precioFinal(100, null, 15, true)).toBe(85);
    expect(precioFinal(100, 20, null, true)).toBe(80);
    expect(precioFinal(100, null, null, true)).toBe(100);
  });

  it('precioFinal redondea a céntimos y nunca es negativo', () => {
    expect(precioFinal(19.99, 10, 5, true)).toBe(16.99);
    expect(precioFinal(100, 60, 50, true)).toBe(0);
  });

  it('descuentoTotal suma los dos porcentajes', () => {
    expect(descuentoTotal(10, 15)).toBe(25);
    expect(descuentoTotal(null, 15)).toBe(15);
    expect(descuentoTotal(null, null)).toBe(0);
  });

  it('textoDescuentoTotal solo aparece si tiene los dos descuentos', () => {
    expect(textoDescuentoTotal(10, 15)).toBe(' (25 % en total)');
    expect(textoDescuentoTotal(10.5, 15)).toBe(' (25,5 % en total)');
    expect(textoDescuentoTotal(null, 15)).toBe('');
    expect(textoDescuentoTotal(10, null)).toBe('');
  });
});
