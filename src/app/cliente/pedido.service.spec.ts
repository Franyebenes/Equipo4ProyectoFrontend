import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import {
  Pedido,
  PedidoService,
  sePuedeCancelar,
  sePuedeConfirmarRecepcion,
  validarDireccion,
} from './pedido.service';

const URL_PEDIDOS = 'http://localhost:8080/api/pedidos';
const ID_PEDIDO = '64b000000000000000000101';
const ID_PRODUCTO = '64b000000000000000000002';
const DIRECCION = { calle: 'Calle Mayor 1', ciudad: 'Ciudad Real', codigoPostal: '13001' };

function pedido(estado: Pedido['estado']): Pedido {
  return {
    id: ID_PEDIDO,
    estado,
    fecha: '2026-10-24T10:15:30Z',
    precioTotal: 36,
    direccionEnvio: DIRECCION,
    lineas: [{ idProducto: ID_PRODUCTO, nombre: 'Teclado', cantidad: 2, precioUnitario: 18, subtotal: 36, valoracion: null }],
  };
}

describe('PedidoService', () => {
  let servicio: PedidoService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(PedidoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('realizar envía la dirección de envío por POST', () => {
    servicio.realizar(DIRECCION).subscribe();

    const peticion = http.expectOne(URL_PEDIDOS);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ direccionEnvio: DIRECCION });
    peticion.flush(pedido('PAGADO'));
  });

  it('historial pide los pedidos por GET', () => {
    servicio.historial().subscribe();

    const peticion = http.expectOne(URL_PEDIDOS);
    expect(peticion.request.method).toBe('GET');
    peticion.flush({ enProceso: [], historicos: [] });
  });

  it('cancelar y confirmarRecepcion llaman a la acción del pedido por POST', () => {
    servicio.cancelar(ID_PEDIDO).subscribe();
    http.expectOne({ method: 'POST', url: `${URL_PEDIDOS}/${ID_PEDIDO}/cancelar` }).flush(pedido('CANCELADO'));

    servicio.confirmarRecepcion(ID_PEDIDO).subscribe();
    http.expectOne({ method: 'POST', url: `${URL_PEDIDOS}/${ID_PEDIDO}/recepcion` }).flush(pedido('FINALIZADO'));
  });

  it('valorar envía los puntos del producto del pedido', () => {
    servicio.valorar(ID_PEDIDO, ID_PRODUCTO, 4).subscribe();

    const peticion = http.expectOne(`${URL_PEDIDOS}/${ID_PEDIDO}/productos/${ID_PRODUCTO}/valoracion`);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ puntos: 4 });
    peticion.flush(null);
  });
});

describe('reglas de los pedidos', () => {
  it('solo se puede cancelar un pedido pagado', () => {
    expect(sePuedeCancelar(pedido('PAGADO'))).toBe(true);
    expect(sePuedeCancelar(pedido('ENVIADO'))).toBe(false);
    expect(sePuedeCancelar(pedido('FINALIZADO'))).toBe(false);
    expect(sePuedeCancelar(pedido('CANCELADO'))).toBe(false);
  });

  it('se puede confirmar la recepción mientras el pedido sigue en curso', () => {
    expect(sePuedeConfirmarRecepcion(pedido('PAGADO'))).toBe(true);
    expect(sePuedeConfirmarRecepcion(pedido('ENVIADO'))).toBe(true);
    expect(sePuedeConfirmarRecepcion(pedido('ENTREGADO'))).toBe(true);
    expect(sePuedeConfirmarRecepcion(pedido('FINALIZADO'))).toBe(false);
    expect(sePuedeConfirmarRecepcion(pedido('CANCELADO'))).toBe(false);
  });
});

describe('validarDireccion', () => {
  it('acepta una dirección completa con código postal de 5 números', () => {
    expect(validarDireccion(DIRECCION)).toBe('');
  });

  it('rechaza una dirección con algún campo vacío', () => {
    expect(validarDireccion({ ...DIRECCION, ciudad: '  ' })).toBe('Indica la calle, la ciudad y el código postal de envío.');
  });

  it('rechaza un código postal que no tenga 5 números', () => {
    expect(validarDireccion({ ...DIRECCION, codigoPostal: '1300' })).toBe('El código postal debe tener 5 números.');
    expect(validarDireccion({ ...DIRECCION, codigoPostal: '13A01' })).toBe('El código postal debe tener 5 números.');
  });
});
