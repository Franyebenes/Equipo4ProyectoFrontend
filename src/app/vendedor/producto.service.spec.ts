import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ProductoAlta, ProductoCatalogo, ProductoService, mensajeEstadoCambiado } from './producto.service';

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
