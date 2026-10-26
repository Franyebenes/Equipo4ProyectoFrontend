import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ProductoService } from '../../vendedor/producto.service';
import { FavoritosService } from '../favoritos.service';
import { CatalogoService, FILTROS_VACIOS, Pagina, ParametrosCatalogo, ProductoCliente } from '../catalogo.service';
import { CATEGORIAS_VISIBLES, Catalogo, ESPERA_PRECIO_MS } from './catalogo';

const TAZA: ProductoCliente = {
  id: 'p1',
  nombre: 'Taza',
  imagen: null,
  categorias: ['Cocina', 'Hogar'],
  precio: 4,
  precioFinal: 3.6,
  soloPremium: false,
  disponibilidad: 'POCO_STOCK',
  valoracionMedia: 4.25,
  numeroValoraciones: 12,
};
const RELOJ: ProductoCliente = {
  ...TAZA,
  id: 'p2',
  nombre: 'Reloj',
  categorias: [],
  precio: 100,
  precioFinal: 100,
  soloPremium: true,
  disponibilidad: 'AGOTADO',
  valoracionMedia: null,
  numeroValoraciones: 0,
};

function pagina(contenido: ProductoCliente[], numero = 0, totalPaginas = 1): Pagina<ProductoCliente> {
  return { contenido, pagina: numero, tamano: 12, totalElementos: contenido.length, totalPaginas };
}

describe('Catalogo (HU-19 Buscar productos)', () => {
  let buscar: ReturnType<typeof vi.fn>;
  let ultimosParametros: ReturnType<typeof signal<ParametrosCatalogo>>;
  let categorias: { id: string; nombre: string }[];

  function crear(parametrosUrl: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      imports: [Catalogo],
      providers: [
        provideRouter([]),
        { provide: CatalogoService, useValue: { buscar, ultimosParametros } },
        { provide: FavoritosService, useValue: { cargarIds: vi.fn(), ids: signal(new Set<string>()) } },
        {
          provide: ProductoService,
          useValue: { listarCategorias: () => of(categorias) },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(parametrosUrl), queryParams: parametrosUrl } },
        },
      ],
    });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(Catalogo);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    buscar = vi.fn().mockReturnValue(of(pagina([TAZA, RELOJ])));
    ultimosParametros = signal<ParametrosCatalogo>({});
    categorias = [
      { id: 'c1', nombre: 'Cocina' },
      { id: 'c2', nombre: 'Moda' },
    ];
  });

  it('al entrar carga la primera página de todo el catálogo', () => {
    crear();
    expect(buscar).toHaveBeenCalledWith(FILTROS_VACIOS, 0);
  });

  it('cada tarjeta muestra nombre, categorías, precio y disponibilidad, sin el stock', () => {
    const texto: string = crear().nativeElement.textContent;
    expect(texto).toContain('Taza');
    expect(texto).toContain('Cocina · Hogar');
    expect(texto).toContain('3,60');
    expect(texto).toContain('Queda poco stock');
    expect(texto).toContain('Agotado');
  });

  it('con descuento muestra tachado el precio original', () => {
    const tachados: HTMLElement[] = Array.from(crear().nativeElement.querySelectorAll('s.precio-original'));
    expect(tachados).toHaveLength(1);
    expect(tachados[0].textContent).toContain('4,00');
  });

  it('marca los productos solo para premium con el óvalo Premium', () => {
    const premium = crear().nativeElement.querySelectorAll('.ovalo.premium');
    expect(premium).toHaveLength(1);
  });

  it('escribir no busca: busca al enviar el formulario (Intro o «Buscar») y vuelve a la primera página', () => {
    const fixture = crear();
    buscar.mockClear();

    fixture.componentInstance.busqueda.set('taza');
    expect(buscar).not.toHaveBeenCalled();
    fixture.nativeElement.querySelector('form.buscador').dispatchEvent(new Event('submit'));

    expect(buscar).toHaveBeenCalledTimes(1);
    expect(buscar).toHaveBeenCalledWith({ ...FILTROS_VACIOS, busqueda: 'taza' }, 0);
  });

  it('con una búsqueda aplicada muestra cuántos hay y un botón para volver a todo el catálogo', () => {
    const fixture = crear();
    fixture.componentInstance.busqueda.set('taza');
    fixture.componentInstance.buscar();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.resumen').textContent).toContain('2 productos para «taza»');
    fixture.nativeElement.querySelector('.resumen button').click();

    expect(buscar).toHaveBeenLastCalledWith(FILTROS_VACIOS, 0);
    expect(fixture.componentInstance.busqueda()).toBe('');
  });

  it('sin foto usa la imagen por defecto entera; con foto, recortada al mismo cuadrado', () => {
    buscar.mockReturnValue(of(pagina([TAZA, { ...RELOJ, imagen: 'data:image/png;base64,iVBORw0KGgo=' }])));
    const imagenes: HTMLImageElement[] = Array.from(crear().nativeElement.querySelectorAll('.foto img'));

    expect(imagenes[0].classList.contains('sin-imagen')).toBe(true);
    expect(imagenes[0].getAttribute('src')).toBe('/producto-sin-imagen.svg');
    expect(imagenes[1].classList.contains('sin-imagen')).toBe(false);
  });

  it('sin resultados muestra un mensaje con lo buscado y permite volver a todo el catálogo', () => {
    const fixture = crear();
    buscar.mockReturnValue(of(pagina([])));

    fixture.componentInstance.busqueda.set('bicicleta');
    fixture.componentInstance.buscar();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No hay productos que coincidan con «bicicleta»');
    buscar.mockReturnValue(of(pagina([TAZA])));
    fixture.nativeElement.querySelector('.vacio button').click();
    expect(buscar).toHaveBeenLastCalledWith(FILTROS_VACIOS, 0);
  });

  it('con varias páginas muestra la paginación y pide la página elegida', () => {
    buscar.mockReturnValue(of(pagina([TAZA], 0, 3)));
    window.scrollTo = vi.fn();
    const fixture = crear();

    const numeros: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('.paginacion .numero'));
    expect(numeros.map((b) => b.textContent?.trim())).toEqual(['1', '2', '3']);
    numeros[2].click();

    expect(buscar).toHaveBeenLastCalledWith(FILTROS_VACIOS, 2);
  });

  it('HU-21: cada tarjeta lleva a la ficha de su producto', () => {
    const enlaces: HTMLAnchorElement[] = Array.from(crear().nativeElement.querySelectorAll('a.enlace-ficha'));
    expect(enlaces.map((a) => a.getAttribute('href'))).toEqual(['/cliente/productos/p1', '/cliente/productos/p2']);
  });

  it('carga la búsqueda y la página que trae la dirección (la página 2 de la dirección es la 1 del backend)', () => {
    buscar.mockReturnValue(of(pagina([TAZA], 1, 3)));
    const fixture = crear({ busqueda: 'taza', pagina: '2' });

    expect(buscar).toHaveBeenCalledWith({ ...FILTROS_VACIOS, busqueda: 'taza' }, 1);
    expect(fixture.componentInstance.busqueda()).toBe('taza');
  });

  it('recuerda la búsqueda y la página para volver desde la ficha', () => {
    buscar.mockReturnValue(of(pagina([TAZA], 1, 3)));
    crear({ busqueda: 'taza', pagina: '2' });

    expect(ultimosParametros()).toEqual({ busqueda: 'taza', pagina: 2 });
  });

  it('sin búsqueda y en la primera página la dirección queda limpia', () => {
    crear();
    expect(ultimosParametros()).toEqual({});
  });

  describe('HU-20 Filtrar productos', () => {
    const chips = (fixture: { nativeElement: HTMLElement }): HTMLButtonElement[] =>
      Array.from(fixture.nativeElement.querySelectorAll('.categorias-nav .chip'));

    it('muestra las categorías y al elegir una filtra por ella desde la primera página', () => {
      const fixture = crear();
      expect(chips(fixture).map((c) => c.textContent?.trim())).toEqual(['Cocina', 'Moda']);

      chips(fixture)[0].click();

      expect(buscar).toHaveBeenLastCalledWith({ ...FILTROS_VACIOS, idCategoria: 'c1' }, 0);
    });

    it('al volver a pulsar la categoría elegida se quita y vuelven todas', () => {
      const fixture = crear();
      chips(fixture)[0].click();
      fixture.detectChanges();
      expect(chips(fixture)[0].classList.contains('elegida')).toBe(true);
      expect(chips(fixture)[0].querySelector('.quitar')).not.toBeNull();

      chips(fixture)[0].click();

      expect(buscar).toHaveBeenLastCalledWith(FILTROS_VACIOS, 0);
    });

    it('con muchas categorías enseña las primeras y el resto en «Más categorías»', () => {
      categorias = Array.from({ length: 20 }, (_, i) => ({ id: `c${i}`, nombre: `Categoría ${i}` }));
      const fixture = crear();

      expect(chips(fixture)).toHaveLength(CATEGORIAS_VISIBLES);
      const opciones = fixture.nativeElement.querySelectorAll('.mas-categorias option');
      expect(opciones).toHaveLength(20 - CATEGORIAS_VISIBLES + 1);
    });

    it('al elegir una del desplegable filtra por ella y se ve marcada como botón', () => {
      categorias = Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, nombre: `Categoría ${i}` }));
      const fixture = crear();
      const desplegable: HTMLSelectElement = fixture.nativeElement.querySelector('.mas-categorias');

      desplegable.value = 'c8';
      desplegable.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(buscar).toHaveBeenLastCalledWith({ ...FILTROS_VACIOS, idCategoria: 'c8' }, 0);
      const ultimo = chips(fixture).at(-1)!;
      expect(ultimo.textContent).toContain('Categoría 8');
      expect(ultimo.classList.contains('elegida')).toBe(true);
      expect(desplegable.value).toBe('');
    });

    it('filtra por valoración mínima y por disponibilidad, y los filtros se combinan', () => {
      const fixture = crear();
      fixture.componentInstance.cambiarValoracion('4');
      fixture.componentInstance.cambiarSoloDisponibles(true);

      expect(buscar).toHaveBeenLastCalledWith({ ...FILTROS_VACIOS, valoracionMinima: 4, soloDisponibles: true }, 0);
    });

    it('filtra por rango de precio', () => {
      const fixture = crear();
      fixture.componentInstance.cambiarPrecioMinimo(5);
      fixture.componentInstance.cambiarPrecioMaximo(20);

      expect(buscar).toHaveBeenLastCalledWith({ ...FILTROS_VACIOS, precioMinimo: 5, precioMaximo: 20 }, 0);
    });

    it('al escribir un precio filtra solo cuando se deja de teclear, sin salir del campo', () => {
      vi.useFakeTimers();
      const fixture = crear();
      buscar.mockClear();
      const minimo: HTMLInputElement = fixture.nativeElement.querySelector('input[aria-label="Precio mínimo"]');

      for (const texto of ['1', '15']) {
        minimo.value = texto;
        minimo.dispatchEvent(new Event('input'));
      }
      expect(buscar).not.toHaveBeenCalled();
      vi.advanceTimersByTime(ESPERA_PRECIO_MS);

      expect(buscar).toHaveBeenCalledTimes(1);
      expect(buscar).toHaveBeenCalledWith({ ...FILTROS_VACIOS, precioMinimo: 15 }, 0);

      // Al salir del campo con el mismo precio no se vuelve a buscar
      minimo.dispatchEvent(new Event('change'));
      expect(buscar).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });

    it('al pulsar Intro en el precio filtra sin esperar', () => {
      vi.useFakeTimers();
      const fixture = crear();
      buscar.mockClear();
      const maximo: HTMLInputElement = fixture.nativeElement.querySelector('input[aria-label="Precio máximo"]');

      maximo.value = '40';
      maximo.dispatchEvent(new Event('input'));
      maximo.dispatchEvent(new Event('change'));

      expect(buscar).toHaveBeenCalledWith({ ...FILTROS_VACIOS, precioMaximo: 40 }, 0);
      vi.advanceTimersByTime(ESPERA_PRECIO_MS);
      expect(buscar).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });

    it('con el precio mínimo mayor que el máximo avisa y no busca', () => {
      const fixture = crear();
      fixture.componentInstance.cambiarPrecioMinimo(30);
      buscar.mockClear();

      fixture.componentInstance.cambiarPrecioMaximo(10);
      fixture.detectChanges();

      expect(buscar).not.toHaveBeenCalled();
      expect(fixture.nativeElement.textContent).toContain('El precio mínimo no puede ser mayor que el máximo.');
    });

    it('sin productos que cumplan los filtros muestra un mensaje y permite ver todo el catálogo', () => {
      const fixture = crear();
      buscar.mockReturnValue(of(pagina([])));
      fixture.componentInstance.cambiarSoloDisponibles(true);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.vacio').textContent).toContain(
        'No hay productos que coincidan con',
      );
      expect(fixture.nativeElement.querySelector('.vacio').textContent).toContain('los filtros elegidos');
      fixture.nativeElement.querySelector('.vacio button').click();
      expect(buscar).toHaveBeenLastCalledWith(FILTROS_VACIOS, 0);
    });

    it('«Quitar filtros» quita los filtros pero mantiene la búsqueda por nombre', () => {
      const fixture = crear();
      fixture.componentInstance.busqueda.set('taza');
      fixture.componentInstance.buscar();
      fixture.componentInstance.cambiarSoloDisponibles(true);
      fixture.detectChanges();

      fixture.nativeElement.querySelector('.filtros .btn-secundario').click();

      expect(buscar).toHaveBeenLastCalledWith({ ...FILTROS_VACIOS, busqueda: 'taza' }, 0);
    });

    it('carga los filtros que trae la dirección', () => {
      crear({ categoria: 'c2', precioMax: '50', valoracion: '3', disponibles: 'true' });

      expect(buscar).toHaveBeenCalledWith(
        { ...FILTROS_VACIOS, idCategoria: 'c2', precioMaximo: 50, valoracionMinima: 3, soloDisponibles: true },
        0,
      );
    });

    it('recuerda los filtros para volver desde la ficha', () => {
      const fixture = crear();
      fixture.componentInstance.elegirCategoria('c1');

      expect(ultimosParametros()).toEqual({ categoria: 'c1' });
    });

    it('cada tarjeta muestra su valoración media si la tiene', () => {
      const tarjetas: HTMLElement[] = Array.from(crear().nativeElement.querySelectorAll('.tarjeta'));

      expect(tarjetas[0].querySelector('.valoracion')?.textContent).toContain('4,3');
      expect(tarjetas[0].querySelector('.valoracion')?.textContent).toContain('(12)');
      expect(tarjetas[1].querySelector('.valoracion')).toBeNull();
    });
  });
});