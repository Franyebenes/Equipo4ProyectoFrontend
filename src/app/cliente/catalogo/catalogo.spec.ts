import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { CatalogoService, Pagina, ParametrosCatalogo, ProductoCliente } from '../catalogo.service';
import { Catalogo } from './catalogo';

const TAZA: ProductoCliente = {
  id: 'p1',
  nombre: 'Taza',
  imagen: null,
  categorias: ['Cocina', 'Hogar'],
  precio: 4,
  precioFinal: 3.6,
  soloPremium: false,
  disponibilidad: 'POCO_STOCK',
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
};

function pagina(contenido: ProductoCliente[], numero = 0, totalPaginas = 1): Pagina<ProductoCliente> {
  return { contenido, pagina: numero, tamano: 12, totalElementos: contenido.length, totalPaginas };
}

describe('Catalogo (HU-19 Buscar productos)', () => {
  let buscar: ReturnType<typeof vi.fn>;
  let ultimosParametros: ReturnType<typeof signal<ParametrosCatalogo>>;

  function crear(parametrosUrl: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      imports: [Catalogo],
      providers: [
        provideRouter([]),
        { provide: CatalogoService, useValue: { buscar, ultimosParametros } },
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
  });

  it('al entrar carga la primera página de todo el catálogo', () => {
    crear();
    expect(buscar).toHaveBeenCalledWith('', 0);
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
    expect(buscar).toHaveBeenCalledWith('taza', 0);
  });

  it('con una búsqueda aplicada muestra cuántos hay y un botón para volver a todo el catálogo', () => {
    const fixture = crear();
    fixture.componentInstance.busqueda.set('taza');
    fixture.componentInstance.buscar();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.resumen').textContent).toContain('2 productos para «taza»');
    fixture.nativeElement.querySelector('.resumen button').click();

    expect(buscar).toHaveBeenLastCalledWith('', 0);
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
    expect(buscar).toHaveBeenLastCalledWith('', 0);
  });

  it('con varias páginas muestra la paginación y pide la página elegida', () => {
    buscar.mockReturnValue(of(pagina([TAZA], 0, 3)));
    window.scrollTo = vi.fn();
    const fixture = crear();

    const numeros: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('.paginacion .numero'));
    expect(numeros.map((b) => b.textContent?.trim())).toEqual(['1', '2', '3']);
    numeros[2].click();

    expect(buscar).toHaveBeenLastCalledWith('', 2);
  });

  it('HU-21: cada tarjeta lleva a la ficha de su producto', () => {
    const enlaces: HTMLAnchorElement[] = Array.from(crear().nativeElement.querySelectorAll('a.enlace-ficha'));
    expect(enlaces.map((a) => a.getAttribute('href'))).toEqual(['/cliente/productos/p1', '/cliente/productos/p2']);
  });

  it('carga la búsqueda y la página que trae la dirección (la página 2 de la dirección es la 1 del backend)', () => {
    buscar.mockReturnValue(of(pagina([TAZA], 1, 3)));
    const fixture = crear({ busqueda: 'taza', pagina: '2' });

    expect(buscar).toHaveBeenCalledWith('taza', 1);
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
});