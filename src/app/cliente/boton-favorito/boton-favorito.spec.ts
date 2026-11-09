import { HttpErrorResponse } from '@angular/common/http';
import { WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { FavoritosService } from '../favoritos.service';
import { BotonFavorito } from './boton-favorito';

describe('BotonFavorito (HU-31.2 y HU-31.3)', () => {
  let ids: WritableSignal<ReadonlySet<string>>;
  let anadir: ReturnType<typeof vi.fn>;
  let quitar: ReturnType<typeof vi.fn>;
  let cargarIds: ReturnType<typeof vi.fn>;

  function crear() {
    TestBed.configureTestingModule({
      imports: [BotonFavorito],
      providers: [{ provide: FavoritosService, useValue: { ids, anadir, quitar, cargarIds } }],
    });
    const fixture = TestBed.createComponent(BotonFavorito);
    fixture.componentRef.setInput('idProducto', 'p1');
    fixture.componentRef.setInput('nombre', 'Taza');
    fixture.detectChanges();
    return fixture;
  }

  const boton = (fixture: { nativeElement: HTMLElement }) =>
    fixture.nativeElement.querySelector('button.corazon') as HTMLButtonElement;

  beforeEach(() => {
    ids = signal<ReadonlySet<string>>(new Set());
    anadir = vi.fn(() => {
      ids.set(new Set(['p1']));
      return of(undefined);
    });
    quitar = vi.fn(() => {
      ids.set(new Set());
      return of(undefined);
    });
    cargarIds = vi.fn();
  });

  afterEach(() => vi.useRealTimers());

  it('si no es favorito, el corazón sale vacío', () => {
    const fixture = crear();
    expect(boton(fixture).classList.contains('lleno')).toBe(false);
    expect(boton(fixture).getAttribute('aria-label')).toBe('Añadir a favoritos Taza');
  });

  it('al pulsarlo lo añade a favoritos y el corazón se rellena', () => {
    const fixture = crear();
    boton(fixture).click();
    fixture.detectChanges();

    expect(anadir).toHaveBeenCalledWith('p1');
    expect(boton(fixture).classList.contains('lleno')).toBe(true);
    expect(boton(fixture).getAttribute('aria-pressed')).toBe('true');
  });

  it('si ya es favorito, al pulsarlo lo quita y avisa del cambio', () => {
    ids.set(new Set(['p1']));
    const fixture = crear();
    const cambios: boolean[] = [];
    fixture.componentInstance.cambio.subscribe((c) => cambios.push(c));

    boton(fixture).click();
    fixture.detectChanges();

    expect(quitar).toHaveBeenCalledWith('p1');
    expect(boton(fixture).classList.contains('lleno')).toBe(false);
    expect(cambios).toEqual([false]);
  });

  it('pulsarlo no sigue el enlace de la tarjeta en la que está', () => {
    const fixture = crear();
    const evento = new MouseEvent('click', { bubbles: true, cancelable: true });
    boton(fixture).dispatchEvent(evento);

    expect(evento.defaultPrevented).toBe(true);
  });

  it('si falla, muestra el mensaje y vuelve a leer los favoritos', () => {
    vi.useFakeTimers();
    anadir.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { mensaje: 'Este producto ya está en tus favoritos' } })),
    );
    const fixture = crear();

    boton(fixture).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.error-favorito').textContent).toContain('ya está en tus favoritos');
    expect(cargarIds).toHaveBeenCalled();
    vi.advanceTimersByTime(4000);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.error-favorito')).toBeNull();
  });
});