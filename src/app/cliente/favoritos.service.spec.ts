import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { FavoritosService, mensajeErrorFavoritos } from './favoritos.service';

const URL = 'http://localhost:8080/api/favoritos';

describe('FavoritosService (HU-31)', () => {
  let servicio: FavoritosService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servicio = TestBed.inject(FavoritosService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('cargarIds guarda los productos favoritos del cliente', () => {
    servicio.cargarIds();
    http.expectOne(`${URL}/ids`).flush(['p1', 'p2']);

    expect([...servicio.ids()]).toEqual(['p1', 'p2']);
  });

  it('listar pide la lista de favoritos', () => {
    servicio.listar().subscribe();

    const peticion = http.expectOne(URL);
    expect(peticion.request.method).toBe('GET');
    peticion.flush([]);
  });

  it('anadir hace un POST del producto y, si sale bien, lo marca como favorito', () => {
    servicio.anadir('p1').subscribe();

    const peticion = http.expectOne(`${URL}/p1`);
    expect(peticion.request.method).toBe('POST');
    peticion.flush(null, { status: 201, statusText: 'Created' });
    expect(servicio.ids().has('p1')).toBe(true);
  });

  it('quitar hace un DELETE del producto y, si sale bien, deja de estar marcado', () => {
    servicio.cargarIds();
    http.expectOne(`${URL}/ids`).flush(['p1', 'p2']);

    servicio.quitar('p1').subscribe();
    const peticion = http.expectOne(`${URL}/p1`);
    expect(peticion.request.method).toBe('DELETE');
    peticion.flush(null, { status: 204, statusText: 'No Content' });

    expect([...servicio.ids()]).toEqual(['p2']);
  });

  it('si añadir falla, el producto no se marca', () => {
    servicio.anadir('p1').subscribe({ error: () => undefined });
    http.expectOne(`${URL}/p1`).flush({ mensaje: 'Error' }, { status: 500, statusText: 'Error' });

    expect(servicio.ids().has('p1')).toBe(false);
  });
});

describe('mensajeErrorFavoritos', () => {
  it('usa el mensaje del backend', () => {
    const error = new HttpErrorResponse({ status: 409, error: { mensaje: 'Este producto ya está en tus favoritos' } });
    expect(mensajeErrorFavoritos(error)).toBe('Este producto ya está en tus favoritos');
  });

  it('sin conexión avisa de que no se puede conectar', () => {
    expect(mensajeErrorFavoritos(new HttpErrorResponse({ status: 0 }))).toContain('No se puede conectar');
  });
});