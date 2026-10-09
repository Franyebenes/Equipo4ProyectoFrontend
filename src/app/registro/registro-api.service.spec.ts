import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SolicitudRegistro } from './registro-api';
import { RegistroApiService } from './registro-api.service';

const URL_REGISTRO = 'http://localhost:8080/api/auth/registro';

describe('RegistroApiService', () => {
  let servicio: RegistroApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(RegistroApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it.each(['CLIENTE', 'PREMIUM'] as const)(
    'envía el registro de un cliente %s al endpoint único, tal cual',
    (tipoCuenta) => {
      const solicitud: SolicitudRegistro = {
        tipoCuenta,
        nombre: 'Ana',
        apellidos: 'García López',
        dni: '12345678Z',
        email: 'ana.garcia@gmail.com',
        telefono: null,
        contrasena: 'una-contrasena-de-prueba',
        repetirContrasena: 'una-contrasena-de-prueba',
        fechaNacimiento: '2000-05-15',
      };
      const respuesta = { id: '1', email: 'ana.garcia@gmail.com', nombre: 'Ana', mensaje: 'ok' };
      let recibida: unknown;

      servicio.registrar(solicitud).subscribe((r) => (recibida = r));

      const peticion = httpTesting.expectOne(URL_REGISTRO);
      expect(peticion.request.method).toBe('POST');
      expect(peticion.request.body).toEqual(solicitud);
      peticion.flush(respuesta, { status: 201, statusText: 'Created' });
      expect(recibida).toEqual(respuesta);
    },
  );

  it('envía el registro de un vendedor al mismo endpoint', () => {
    const solicitud: SolicitudRegistro = {
      tipoCuenta: 'VENDEDOR',
      nombre: 'Luis',
      apellidos: 'Pérez Mora',
      dni: 'B12345678',
      email: 'luis.perez@gmail.com',
      telefono: '699887766',
      contrasena: 'una-contrasena-de-prueba',
      repetirContrasena: 'una-contrasena-de-prueba',
      nombreComercial: 'Tienda Norte',
      categoriaPrincipalId: '64b7f0c2a1b2c3d4e5f60718',
    };

    servicio.registrar(solicitud).subscribe();

    const peticion = httpTesting.expectOne(URL_REGISTRO);
    expect(peticion.request.body).toEqual(solicitud);
    peticion.flush({}, { status: 201, statusText: 'Created' });
  });

  it('pide las categorías por GET', () => {
    const categorias = [{ id: '64b7f0c2a1b2c3d4e5f60718', nombre: 'Electrónica' }];
    let recibidas: unknown;

    servicio.categorias().subscribe((c) => (recibidas = c));

    const peticion = httpTesting.expectOne('http://localhost:8080/api/registro/categorias');
    expect(peticion.request.method).toBe('GET');
    peticion.flush(categorias);
    expect(recibidas).toEqual(categorias);
  });
});
