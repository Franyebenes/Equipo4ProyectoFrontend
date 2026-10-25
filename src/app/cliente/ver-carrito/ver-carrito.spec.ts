import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { Carrito, CarritoService, LineaCarrito } from '../carrito.service';
import { VerCarrito } from './ver-carrito';

const linea = (idProducto: string, nombre: string): LineaCarrito => ({
  idProducto,
  nombre,
  imagen: null,
  precioUnitario: 10,
  precioOriginal: 10,
  cantidad: 2,
  subtotal: 20,
  disponible: true,
});
const CARRITO: Carrito = { lineas: [linea('p1', 'Taza'), linea('p2', 'Vaso')], numeroArticulos: 4, total: 40 };

describe('VerCarrito: errores dentro de la línea del producto', () => {
  let cambiarCantidad: ReturnType<typeof vi.fn>;

  function crear() {
    TestBed.configureTestingModule({
      imports: [VerCarrito],
      providers: [
        provideRouter([]),
        { provide: CarritoService, useValue: { obtener: () => of(CARRITO), cambiarCantidad, eliminar: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(VerCarrito);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    cambiarCantidad = vi.fn().mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { mensaje: 'No hay stock suficiente de este producto' } })),
    );
  });

  it('sin stock para subir la cantidad, el error sale en la línea de ese producto y no arriba', () => {
    const fixture = crear();
    const lineas: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('li.linea'));

    lineas[1].querySelector<HTMLButtonElement>('button[aria-label="Añadir una unidad"]')!.click();
    fixture.detectChanges();

    expect(lineas[1].querySelector('.error-linea')?.textContent).toContain('No hay stock suficiente');
    expect(lineas[0].querySelector('.error-linea')).toBeNull();
    expect(fixture.nativeElement.querySelector('p.error')).toBeNull();
  });

  it('el error desaparece cuando el siguiente cambio sale bien', () => {
    const fixture = crear();
    const boton = () =>
      fixture.nativeElement.querySelectorAll('li.linea')[1].querySelector('button[aria-label="Añadir una unidad"]');
    boton().click();
    fixture.detectChanges();

    cambiarCantidad.mockReturnValue(of(CARRITO));
    fixture.nativeElement.querySelectorAll('li.linea')[1].querySelector('button[aria-label="Quitar una unidad"]').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.error-linea')).toBeNull();
  });

  it('tiene un enlace para seguir comprando que lleva al catálogo', () => {
    const volver: HTMLAnchorElement = crear().nativeElement.querySelector('a.volver');
    expect(volver.getAttribute('href')).toBe('/cliente');
  });
});