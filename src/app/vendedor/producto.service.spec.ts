import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ProductoService } from './producto.service';

const URL_CATALOGO = 'http://localhost:8080/api/vendedor/productos';

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
