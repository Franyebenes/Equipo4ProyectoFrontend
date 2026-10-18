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
});
