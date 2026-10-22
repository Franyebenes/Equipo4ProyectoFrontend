import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import {
  ProductoAlta,
  ProductoCatalogo,
  ProductoService,
  mensajeConfirmarEliminacion,
  mensajeEstadoCambiado,
  mensajeProductoEliminado,
  mensajeStockActualizado,
  textoStock,
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

  it('cambiarStock pide el token CSRF y envía un PATCH con la cantidad nueva', () => {
    let respuesta: ProductoCatalogo | undefined;
    servicio.cambiarStock('p1', 12).subscribe({ next: (producto) => (respuesta = producto) });

    http.expectOne(URL_CSRF).flush({ token: 'token-3', headerName: 'X-XSRF-TOKEN' });
    const peticion = http.expectOne(`${URL_CATALOGO}/p1/stock`);
    expect(peticion.request.method).toBe('PATCH');
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

  it('crear también envía el token CSRF', () => {
    const alta: ProductoAlta = {
      nombre: 'Lámpara', descripcion: 'De pie', precio: 80, idCategorias: ['c1'], stock: 4,
      imagen: null, activo: true, descuento: null,
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
