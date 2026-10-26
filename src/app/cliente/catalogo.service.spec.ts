import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import {
  CatalogoService,
  FILTROS_VACIOS,
  ProductoCliente,
  filtrosAParametros,
  filtrosDeParametros,
  hayFiltros,
  mensajeErrorCatalogoCliente,
  tieneDescuento,
  validarFiltros,
} from './catalogo.service';
import { convertToParamMap } from '@angular/router';

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
    servicio.buscar(FILTROS_VACIOS, 0).subscribe();

    const peticion = http.expectOne((r) => r.url === URL_CATALOGO);
    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.params.get('pagina')).toBe('0');
    expect(peticion.request.params.has('busqueda')).toBe(false);
    peticion.flush({ contenido: [], pagina: 0, tamano: 12, totalElementos: 0, totalPaginas: 0 });
  });

  it('manda la búsqueda sin los espacios de los extremos', () => {
    servicio.buscar({ ...FILTROS_VACIOS, busqueda: '  taza ' }, 2).subscribe();

    const peticion = http.expectOne((r) => r.url === URL_CATALOGO);
    expect(peticion.request.params.get('busqueda')).toBe('taza');
    expect(peticion.request.params.get('pagina')).toBe('2');
    peticion.flush({ contenido: [], pagina: 2, tamano: 12, totalElementos: 0, totalPaginas: 0 });
  });
});

describe('CatalogoService.obtener (HU-21)', () => {
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

  it('pide la ficha del producto por su id', () => {
    servicio.obtener('p1').subscribe();

    const peticion = http.expectOne(`${URL_CATALOGO}/p1`);
    expect(peticion.request.method).toBe('GET');
    peticion.flush({});
  });
});

describe('CatalogoService.buscar con filtros (HU-20)', () => {
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

  it('manda cada filtro con su nombre y se combinan', () => {
    servicio
      .buscar(
        { busqueda: 'taza', idCategoria: 'c1', precioMinimo: 5, precioMaximo: 20, valoracionMinima: 4, soloDisponibles: true },
        0,
      )
      .subscribe();

    const params = http.expectOne((r) => r.url === URL_CATALOGO).request.params;
    expect(params.get('busqueda')).toBe('taza');
    expect(params.get('idCategoria')).toBe('c1');
    expect(params.get('precioMinimo')).toBe('5');
    expect(params.get('precioMaximo')).toBe('20');
    expect(params.get('valoracionMinima')).toBe('4');
    expect(params.get('soloDisponibles')).toBe('true');
  });

  it('sin filtros solo manda la página', () => {
    servicio.buscar(FILTROS_VACIOS, 1).subscribe();

    const params = http.expectOne((r) => r.url === URL_CATALOGO).request.params;
    expect(params.keys()).toEqual(['pagina']);
  });
});

describe('validarFiltros', () => {
  it('sin filtros o con filtros correctos no hay error', () => {
    expect(validarFiltros(FILTROS_VACIOS)).toBe('');
    expect(validarFiltros({ ...FILTROS_VACIOS, precioMinimo: 10, precioMaximo: 10, valoracionMinima: 5 })).toBe('');
  });

  it('el precio mínimo no puede ser mayor que el máximo', () => {
    expect(validarFiltros({ ...FILTROS_VACIOS, precioMinimo: 20, precioMaximo: 10 })).toBe(
      'El precio mínimo no puede ser mayor que el máximo.',
    );
  });

  it('el precio no puede ser negativo', () => {
    expect(validarFiltros({ ...FILTROS_VACIOS, precioMaximo: -1 })).toBe('El precio no puede ser negativo.');
  });
});

describe('hayFiltros', () => {
  it('la búsqueda por nombre sola no cuenta como filtro', () => {
    expect(hayFiltros({ ...FILTROS_VACIOS, busqueda: 'taza' })).toBe(false);
    expect(hayFiltros({ ...FILTROS_VACIOS, soloDisponibles: true })).toBe(true);
  });
});

describe('filtros en la dirección', () => {
  it('solo pone en la dirección lo que tiene valor', () => {
    expect(filtrosAParametros(FILTROS_VACIOS)).toEqual({});
    expect(filtrosAParametros({ ...FILTROS_VACIOS, idCategoria: 'c1', precioMaximo: 20, soloDisponibles: true })).toEqual({
      categoria: 'c1',
      precioMax: 20,
      disponibles: true,
    });
  });

  it('recupera los filtros de la dirección e ignora los números que no lo son', () => {
    const filtros = filtrosDeParametros(
      convertToParamMap({ busqueda: 'taza', categoria: 'c1', precioMin: 'barato', precioMax: '20', valoracion: '4', disponibles: 'true' }),
    );
    expect(filtros).toEqual({
      busqueda: 'taza',
      idCategoria: 'c1',
      precioMinimo: null,
      precioMaximo: 20,
      valoracionMinima: 4,
      soloDisponibles: true,
    });
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