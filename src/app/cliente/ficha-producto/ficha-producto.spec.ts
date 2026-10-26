import { HttpErrorResponse } from '@angular/common/http';
import { WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AuthService } from '../../core/auth.service';
import { CarritoService } from '../carrito.service';
import { CatalogoService, ProductoDetalle } from '../catalogo.service';
import { FavoritosService } from '../favoritos.service';
import { CANTIDAD_MAXIMA, FichaProducto, estrellas, motivoNoComprar } from './ficha-producto';

const RELOJ: ProductoDetalle = {
  id: 'p1',
  nombre: 'Reloj',
  descripcion: 'Reloj de pulsera de acero.',
  imagen: 'data:image/png;base64,iVBORw0KGgo=',
  categorias: ['Moda', 'Complementos'],
  precio: 100,
  precioFinal: 80,
  descuento: 20,
  descuentoPremium: 10,
  soloPremium: false,
  disponibilidad: 'POCO_STOCK',
  valoracionMedia: null,
  numeroValoraciones: 0,
};

describe('FichaProducto (HU-21 Ver detalle del producto)', () => {
  let obtener: ReturnType<typeof vi.fn>;
  let rol: string;
  let anadir: ReturnType<typeof vi.fn>;
  let numeroArticulos: WritableSignal<number>;

  function crear() {
    TestBed.configureTestingModule({
      imports: [FichaProducto],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'p1' }) } } },
        { provide: CatalogoService, useValue: { obtener, ultimosParametros: signal({ busqueda: 'reloj' }) } },
        { provide: AuthService, useValue: { usuario: () => ({ rol }) } },
        { provide: CarritoService, useValue: { anadir, numeroArticulos } },
        { provide: FavoritosService, useValue: { cargarIds: vi.fn(), ids: signal(new Set<string>()) } },
      ],
    });
    const fixture = TestBed.createComponent(FichaProducto);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    obtener = vi.fn().mockReturnValue(of(RELOJ));
    rol = 'CLIENTE';
    numeroArticulos = signal(0);
    // Como el CarritoService real: al añadir, sube el contador de la cabecera
    anadir = vi.fn((_id: string, cantidad: number) => {
      numeroArticulos.update((n) => n + cantidad);
      return of(undefined);
    });
  });

  it('HU-31: tiene el corazón de favoritos encima de la imagen', () => {
    const corazon = crear().nativeElement.querySelector('.galeria app-boton-favorito button.corazon');
    expect(corazon).not.toBeNull();
  });

  it('pide al backend el producto de la dirección', () => {
    crear();
    expect(obtener).toHaveBeenCalledWith('p1');
  });

  it('muestra nombre, descripción, categorías, precio, descuento y disponibilidad, sin el stock', () => {
    const texto: string = crear().nativeElement.textContent;
    expect(texto).toContain('Reloj');
    expect(texto).toContain('Reloj de pulsera de acero.');
    expect(texto).toContain('Moda · Complementos');
    expect(texto).toContain('80,00');
    expect(texto).toContain('−20 % para todos los clientes');
    expect(texto).toContain('Queda poco stock');
  });

  it('a un cliente estándar le enseña el precio que tendría con premium', () => {
    expect(crear().nativeElement.textContent).toContain('Con premium, un 10 % más: 72,00');
  });

  it('a un cliente premium le indica que el precio ya incluye su descuento', () => {
    rol = 'PREMIUM';
    obtener.mockReturnValue(of({ ...RELOJ, precioFinal: 72 }));
    expect(crear().nativeElement.textContent).toContain('Incluye tu descuento premium del 10 %');
  });

  it('si se puede comprar, muestra el botón «Añadir al carrito»', () => {
    const fixture = crear();
    expect(fixture.nativeElement.querySelector('app-boton-anadir-carrito')).not.toBeNull();
  });

  it('se elige cuántas unidades añadir al carrito, entre 1 y 10', () => {
    const fixture = crear();
    const [menos, mas]: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('.selector-cantidad button'));
    expect(menos.disabled).toBe(true);

    mas.click();
    mas.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.selector-cantidad span').textContent.trim()).toBe('3');

    fixture.nativeElement.querySelector('app-boton-anadir-carrito button').click();
    expect(anadir).toHaveBeenCalledWith('p1', 3);
  });

  it('después de añadir al carrito, la cantidad vuelve a 1', () => {
    const fixture = crear();
    fixture.componentInstance.cambiarCantidad(2);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('app-boton-anadir-carrito button').click();
    fixture.detectChanges();

    expect(numeroArticulos()).toBe(3);
    expect(fixture.componentInstance.cantidad()).toBe(1);
    expect(fixture.nativeElement.querySelector('.selector-cantidad span').textContent.trim()).toBe('1');
  });

  it('la cantidad no pasa del máximo', () => {
    const fixture = crear();
    for (let i = 0; i < CANTIDAD_MAXIMA + 5; i++) {
      fixture.componentInstance.cambiarCantidad(1);
    }
    expect(fixture.componentInstance.cantidad()).toBe(CANTIDAD_MAXIMA);
  });

  it('si está agotado, en vez del botón avisa de que está agotado', () => {
    obtener.mockReturnValue(of({ ...RELOJ, disponibilidad: 'AGOTADO' }));
    const fixture = crear();

    expect(fixture.nativeElement.querySelector('app-boton-anadir-carrito')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Producto agotado');
  });

  it('al pulsar la foto se ve en grande y se cierra con Escape', () => {
    const fixture = crear();
    fixture.nativeElement.querySelector('button.ampliable').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.visor img')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.visor')).toBeNull();
  });

  it('sin valoraciones lo indica', () => {
    expect(crear().nativeElement.textContent).toContain('Este producto todavía no tiene valoraciones.');
  });

  it('con valoraciones muestra la puntuación media y cuántas hay', () => {
    obtener.mockReturnValue(of({ ...RELOJ, valoracionMedia: 4.25, numeroValoraciones: 12 }));
    const texto: string = crear().nativeElement.textContent;
    expect(texto).toContain('Puntuación media de 4,3 sobre 5, con 12 valoraciones');
  });

  it('si el producto no existe o está inactivo muestra un mensaje de error', () => {
    obtener.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    const fixture = crear();

    expect(fixture.nativeElement.textContent).toContain('Este producto no existe o ya no está disponible.');
    expect(fixture.nativeElement.querySelector('.ficha')).toBeNull();
  });

  it('«Volver al catálogo» recupera la búsqueda que tenía el cliente', () => {
    const volver: HTMLAnchorElement = crear().nativeElement.querySelector('a.volver');
    expect(volver.getAttribute('href')).toBe('/cliente?busqueda=reloj');
  });
});

describe('motivoNoComprar', () => {
  it('no hay motivo si está disponible y no es solo premium', () => {
    expect(motivoNoComprar(RELOJ, false)).toBe('');
  });

  it('un producto solo premium no lo puede comprar un cliente estándar, pero sí uno premium', () => {
    const soloPremium = { ...RELOJ, soloPremium: true };
    expect(motivoNoComprar(soloPremium, false)).toBe('Solo disponible para clientes premium.');
    expect(motivoNoComprar(soloPremium, true)).toBe('');
  });

  it('agotado no se puede comprar, aunque el cliente sea premium', () => {
    expect(motivoNoComprar({ ...RELOJ, disponibilidad: 'AGOTADO' }, true)).toContain('agotado');
  });
});

describe('estrellas', () => {
  it('redondea la media a la estrella más cercana', () => {
    expect(estrellas(4.25)).toEqual([true, true, true, true, false]);
    expect(estrellas(2.5)).toEqual([true, true, true, false, false]);
  });
});