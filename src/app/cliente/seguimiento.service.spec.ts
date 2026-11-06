import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import {
  SeguimientoPedido,
  SeguimientoService,
  etiquetaEstado,
  formatearDia,
  mensajeErrorSeguimiento,
  textoSinSeguimiento,
} from './seguimiento.service';

const ID_PEDIDO = '64c000000000000000000101';

const CANCELADO: SeguimientoPedido = {
  id: ID_PEDIDO,
  estado: 'CANCELADO',
  fecha: '2026-11-02T09:30:00Z',
  fechaActualizacion: '2026-11-02T16:00:00Z',
  fechaEntregaEstimada: null,
  fechaEntrega: null,
  disponible: false,
  pasos: [],
};

describe('SeguimientoService (Estado del envío)', () => {
  let servicio: SeguimientoService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(SeguimientoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide el seguimiento del pedido al backend', () => {
    let recibido: SeguimientoPedido | undefined;
    servicio.obtener(ID_PEDIDO).subscribe((s) => (recibido = s));

    const peticion = http.expectOne(`http://localhost:8080/api/pedidos/${ID_PEDIDO}/seguimiento`);
    expect(peticion.request.method).toBe('GET');
    peticion.flush(CANCELADO);

    expect(recibido).toEqual(CANCELADO);
  });

  it('codifica el id para que no pueda cambiar la ruta', () => {
    servicio.obtener('../carrito').subscribe();

    http.expectOne('http://localhost:8080/api/pedidos/..%2Fcarrito/seguimiento').flush(CANCELADO);
  });
});

describe('Estado del envío: textos', () => {
  it('cada paso del envío tiene su etiqueta', () => {
    expect(etiquetaEstado('EN_PREPARACION')).toBe('En preparación');
    expect(etiquetaEstado('EN_REPARTO')).toBe('En reparto');
  });

  it('la fecha estimada es un día escrito en palabras, sin cambiar de día por la zona horaria', () => {
    expect(formatearDia('2026-11-07')).toBe('sábado, 7 de noviembre');
  });

  it('un pedido cancelado explica que no tiene seguimiento', () => {
    expect(textoSinSeguimiento(CANCELADO)).toContain('cancelado');
  });

  it('con 404 muestra el mensaje del backend', () => {
    const error = new HttpErrorResponse({ status: 404, error: { mensaje: 'El pedido no existe' } });
    expect(mensajeErrorSeguimiento(error)).toBe('El pedido no existe');
  });

  it('sin conexión avisa de que el backend no responde', () => {
    expect(mensajeErrorSeguimiento(new HttpErrorResponse({ status: 0 }))).toContain('backend');
  });
});
