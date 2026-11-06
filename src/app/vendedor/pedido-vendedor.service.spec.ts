import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import {
  ESTADOS_FILTRO,
  PedidoRecibido,
  PedidoVendedorService,
  diaDeHoy,
  esEstadoFiltrable,
  etiquetaEstadoPedido,
  mensajeConfirmarCambioEstado,
  mensajeErrorPedidosRecibidos,
  mensajeEstadoActualizado,
  referenciaPedido,
  textoUnidades,
} from './pedido-vendedor.service';

const URL_PEDIDOS = 'http://localhost:8080/api/vendedor/pedidos';
const ID_PEDIDO = '64c000000000000000000101';

const PEDIDO: PedidoRecibido = {
  id: ID_PEDIDO,
  fecha: '2026-11-02T09:30:00Z',
  cliente: 'Ana López',
  importe: 36,
  estado: 'PAGADO',
  unidades: 2,
};

describe('PedidoVendedorService', () => {
  let servicio: PedidoVendedorService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(PedidoVendedorService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listar pide los pedidos recibidos sin parámetros', () => {
    let recibidos: PedidoRecibido[] | undefined;
    servicio.listar().subscribe((lista) => (recibidos = lista));

    const peticion = http.expectOne(URL_PEDIDOS);
    expect(peticion.request.method).toBe('GET');
    peticion.flush([PEDIDO]);

    expect(recibidos).toEqual([PEDIDO]);
  });

  it('obtener pide el detalle del pedido por su id', () => {
    servicio.obtener(ID_PEDIDO).subscribe();

    const peticion = http.expectOne(`${URL_PEDIDOS}/${ID_PEDIDO}`);
    expect(peticion.request.method).toBe('GET');
    peticion.flush({ ...PEDIDO, direccionEnvio: null, lineas: [] });
  });

  it('cambiarEstado envía el nuevo estado con PATCH a la ruta del pedido', () => {
    let detalle: unknown;
    servicio.cambiarEstado(ID_PEDIDO, 'ENVIADO').subscribe((d) => (detalle = d));

    const peticion = http.expectOne(`${URL_PEDIDOS}/${ID_PEDIDO}/estado`);
    expect(peticion.request.method).toBe('PATCH');
    expect(peticion.request.body).toEqual({ estado: 'ENVIADO' });
    const actualizado = {
      ...PEDIDO,
      estado: 'ENVIADO',
      fechaActualizacion: '2026-11-03T12:00:00Z',
      estadosSiguientes: ['EN_REPARTO', 'ENTREGADO'],
      direccionEnvio: null,
      lineas: [],
    };
    peticion.flush(actualizado);

    expect(detalle).toEqual(actualizado);
  });

  it('cambiarEstado envía también la fecha estimada de entrega si se indica', () => {
    servicio.cambiarEstado(ID_PEDIDO, 'ENVIADO', '2026-11-10').subscribe();

    const peticion = http.expectOne(`${URL_PEDIDOS}/${ID_PEDIDO}/estado`);
    expect(peticion.request.body).toEqual({ estado: 'ENVIADO', fechaEntregaEstimada: '2026-11-10' });
    peticion.flush({});
  });

  it('obtener codifica el id para que no pueda cambiar la ruta', () => {
    servicio.obtener('../productos').subscribe();

    http.expectOne(`${URL_PEDIDOS}/..%2Fproductos`).flush({});
  });
});

describe('Pedidos recibidos: textos', () => {
  it('la referencia son los 8 últimos caracteres del id en mayúsculas', () => {
    expect(referenciaPedido('64c0000000000000abcdef01')).toBe('#ABCDEF01');
  });

  it('las unidades se escriben en singular o plural', () => {
    expect(textoUnidades(1)).toBe('1 unidad');
    expect(textoUnidades(3)).toBe('3 unidades');
  });

  it('cada estado tiene su etiqueta', () => {
    expect(etiquetaEstadoPedido('PAGADO')).toBe('Pagado');
    expect(etiquetaEstadoPedido('ENVIADO')).toBe('Enviado');
  });

  it('se puede filtrar por todos los estados salvo PENDIENTE, en el orden del envío', () => {
    expect(ESTADOS_FILTRO).toEqual([
      'PAGADO',
      'EN_PREPARACION',
      'ENVIADO',
      'EN_REPARTO',
      'ENTREGADO',
      'FINALIZADO',
      'CANCELADO',
    ]);
  });

  it('los estados nuevos del envío tienen su etiqueta', () => {
    expect(etiquetaEstadoPedido('EN_PREPARACION')).toBe('En preparación');
    expect(etiquetaEstadoPedido('EN_REPARTO')).toBe('En reparto');
  });

  it('antes de cambiar el estado avisa de que no se puede volver atrás', () => {
    const mensaje = mensajeConfirmarCambioEstado(PEDIDO, 'ENVIADO');
    expect(mensaje).toContain('#00000101');
    expect(mensaje).toContain('de «Pagado» a «Enviado»');
    expect(mensaje).toContain('no podrá volver a un estado anterior');
  });

  it('si se indica la fecha estimada, la confirmación la incluye', () => {
    expect(mensajeConfirmarCambioEstado(PEDIDO, 'ENVIADO', '2026-11-10')).toContain(
      'La entrega estimada será el martes, 10 de noviembre.',
    );
  });

  it('hoy se escribe como AAAA-MM-DD', () => {
    expect(diaDeHoy(new Date(2026, 10, 6, 23, 59))).toBe('2026-11-06');
  });

  it('al cambiar el estado confirma el estado nuevo', () => {
    expect(mensajeEstadoActualizado('EN_REPARTO')).toBe(
      'Estado actualizado: el pedido está ahora «En reparto».',
    );
  });

  it('con 409 muestra el mensaje del backend', () => {
    const error = new HttpErrorResponse({
      status: 409,
      error: { mensaje: 'El envío solo puede avanzar: elige un estado posterior al actual' },
    });
    expect(mensajeErrorPedidosRecibidos(error)).toContain('solo puede avanzar');
  });

  it('solo acepta como filtro un estado conocido de la dirección de la página', () => {
    expect(esEstadoFiltrable('ENVIADO')).toBe(true);
    expect(esEstadoFiltrable('PENDIENTE')).toBe(false);
    expect(esEstadoFiltrable('inventado')).toBe(false);
    expect(esEstadoFiltrable(null)).toBe(false);
  });

  it('sin conexión avisa de que el backend no responde', () => {
    expect(mensajeErrorPedidosRecibidos(new HttpErrorResponse({ status: 0 }))).toContain('backend');
  });

  it('con 403 explica que solo los vendedores pueden verlos', () => {
    expect(mensajeErrorPedidosRecibidos(new HttpErrorResponse({ status: 403 }))).toBe(
      'Solo los vendedores pueden consultar los pedidos recibidos.',
    );
  });

  it('con 404 muestra el mensaje del backend', () => {
    const error = new HttpErrorResponse({ status: 404, error: { mensaje: 'El pedido no existe' } });
    expect(mensajeErrorPedidosRecibidos(error)).toBe('El pedido no existe');
  });
});
