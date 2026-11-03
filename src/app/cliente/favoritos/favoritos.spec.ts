import { HttpErrorResponse } from '@angular/common/http';
import { WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ProductoCliente } from '../catalogo.service';
import { FavoritosService } from '../favoritos.service';
import { Favoritos } from './favoritos';

const producto = (id: string, nombre: string): ProductoCliente => ({
  id,
  nombre,
  imagen: null,
  categorias: ['Cocina'],
  precio: 4,
  precioFinal: 4,
  soloPremium: false,
  disponibilidad: 'DISPONIBLE',
  valoracionMedia: null,
  numeroValoraciones: 0,
});

describe('Favoritos (HU-31.1 Ver lista de favoritos)', () => {
  let ids: WritableSignal<ReadonlySet<string>>;
  let listar: ReturnType<typeof vi.fn>;

  function crear() {
    TestBed.configureTestingModule({
      imports: [Favoritos],
      providers: [
        provideRouter([]),
        {
          provide: FavoritosService,
          useValue: {
            ids,
            listar,
            cargarIds: vi.fn(),
            quitar: vi.fn(() => {
              ids.set(new Set(['p2']));
              return of(undefined);
            }),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(Favoritos);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    ids = signal<ReadonlySet<string>>(new Set(['p1', 'p2']));
    listar = vi.fn().mockReturnValue(of([producto('p1', 'Taza'), producto('p2', 'Vaso')]));
  });

  it('muestra sus favoritos con nombre, precio, categoría y disponibilidad', () => {
    const texto: string = crear().nativeElement.textContent;
    expect(texto).toContain('Taza');
    expect(texto).toContain('Vaso');
    expect(texto).toContain('Cocina');
    expect(texto).toContain('4,00');
    expect(texto).toContain('Disponible');
    expect(texto).toContain('2 productos guardados');
  });

  it('desde cada favorito se abre su ficha', () => {
    const enlaces: HTMLAnchorElement[] = Array.from(crear().nativeElement.querySelectorAll('a.enlace-ficha'));
    expect(enlaces.map((a) => a.getAttribute('href'))).toEqual(['/cliente/productos/p1', '/cliente/productos/p2']);
  });

  it('al quitar uno con el corazón deja de verse en la lista', () => {
    const fixture = crear();
    fixture.nativeElement.querySelector('li.tarjeta button.corazon').click();
    fixture.detectChanges();

    const nombres = Array.from(fixture.nativeElement.querySelectorAll('.nombre')).map((n) => (n as HTMLElement).textContent);
    expect(nombres).toEqual(['Vaso']);
  });

  it('sin favoritos muestra un mensaje y un enlace al catálogo', () => {
    listar.mockReturnValue(of([]));
    const fixture = crear();

    expect(fixture.nativeElement.textContent).toContain('Todavía no tienes productos favoritos.');
    expect(fixture.nativeElement.querySelector('.vacio a').getAttribute('href')).toBe('/cliente');
  });

  it('si no se puede cargar, muestra un mensaje de error', () => {
    listar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    expect(crear().nativeElement.textContent).toContain('No se puede conectar con el servidor');
  });
});