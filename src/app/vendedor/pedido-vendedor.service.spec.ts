import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import {
  ESTADOS_FILTRO,
  PedidoRecibido,
  PedidoVendedorService,
  esEstadoFiltrable,
  etiquetaEstadoPedido,
  mensajeErrorPedidosRecibidos,
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

  it('se puede filtrar por todos los estados salvo PENDIENTE, que la aplicación no usa', () => {
    expect(ESTADOS_FILTRO).toContain('PAGADO');
    expect(ESTADOS_FILTRO).toContain('CANCELADO');
    expect(ESTADOS_FILTRO).not.toContain('PENDIENTE');
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
