import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { CatalogoService, ProductoCliente, mensajeErrorCatalogoCliente, tieneDescuento } from './catalogo.service';

const URL_CATALOGO = 'http://localhost:8080/api/catalogo';

describe('CatalogoService.buscar (HU-19)', () => {
  let servicio: CatalogoService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(CatalogoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sin búsqueda pide la página indicada y no manda el parámetro busqueda', () => {
    servicio.buscar('', 0).subscribe();

    const peticion = http.expectOne((r) => r.url === URL_CATALOGO);
    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.params.get('pagina')).toBe('0');
    expect(peticion.request.params.has('busqueda')).toBe(false);
    peticion.flush({ contenido: [], pagina: 0, tamano: 12, totalElementos: 0, totalPaginas: 0 });
  });

  it('manda la búsqueda sin los espacios de los extremos', () => {
    servicio.buscar('  taza ', 2).subscribe();

    const peticion = http.expectOne((r) => r.url === URL_CATALOGO);
    expect(peticion.request.params.get('busqueda')).toBe('taza');
    expect(peticion.request.params.get('pagina')).toBe('2');
    peticion.flush({ contenido: [], pagina: 2, tamano: 12, totalElementos: 0, totalPaginas: 0 });
  });
});

describe('tieneDescuento', () => {
  const producto = (precio: number, precioFinal: number) => ({ precio, precioFinal }) as ProductoCliente;

  it('es true solo si el precio final es menor que el original', () => {
    expect(tieneDescuento(producto(10, 8))).toBe(true);
    expect(tieneDescuento(producto(10, 10))).toBe(false);
  });
});

describe('mensajeErrorCatalogoCliente', () => {
  it('sin conexión avisa de que no se puede conectar', () => {
    expect(mensajeErrorCatalogoCliente(new HttpErrorResponse({ status: 0 }))).toContain('No se puede conectar');
  });

  it('con 403 explica que el catálogo es solo para clientes', () => {
    expect(mensajeErrorCatalogoCliente(new HttpErrorResponse({ status: 403 }))).toBe(
      'Solo los clientes pueden ver el catálogo.',
    );
  });

  it('con otro error usa el mensaje del backend', () => {
    const error = new HttpErrorResponse({ status: 400, error: { mensaje: 'Página no válida' } });
    expect(mensajeErrorCatalogoCliente(error)).toBe('Página no válida');
  });
});