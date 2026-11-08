import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { SeguimientoPedido, SeguimientoService } from '../seguimiento.service';
import { VentanaSeguimiento } from './seguimiento-pedido';

const ID_PEDIDO = '64c000000000000000000101';

function seguimiento(cambios: Partial<SeguimientoPedido> = {}): SeguimientoPedido {
  return {
    id: ID_PEDIDO,
    estado: 'ENVIADO',
    fecha: '2026-11-02T09:30:00Z',
    fechaActualizacion: '2026-11-03T10:00:00Z',
    fechaEntregaEstimada: '2026-11-07',
    fechaEntrega: null,
    disponible: true,
    pasos: [
      { estado: 'PAGADO', completado: true, actual: false, fecha: '2026-11-02T09:30:00Z' },
      { estado: 'EN_PREPARACION', completado: true, actual: false, fecha: '2026-11-02T16:00:00Z' },
      { estado: 'ENVIADO', completado: true, actual: true, fecha: '2026-11-03T10:00:00Z' },
      { estado: 'EN_REPARTO', completado: false, actual: false, fecha: null },
      { estado: 'ENTREGADO', completado: false, actual: false, fecha: null },
    ],
    ...cambios,
  };
}

// El texto de la plantilla puede ir repartido en varias líneas: se juntan los espacios
function texto(elemento: HTMLElement): string {
  return (elemento.textContent ?? '').replace(/\s+/g, ' ');
}

describe('VentanaSeguimiento (Estado del envío)', () => {
  let obtener: ReturnType<typeof vi.fn>;

  function crear() {
    TestBed.configureTestingModule({
      imports: [VentanaSeguimiento],
      providers: [{ provide: SeguimientoService, useValue: { obtener } }],
    });
    const fixture = TestBed.createComponent(VentanaSeguimiento);
    fixture.componentRef.setInput('idPedido', ID_PEDIDO);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    obtener = vi.fn().mockReturnValue(of(seguimiento()));
  });

  it('al abrirse pide el seguimiento del pedido', () => {
    crear();
    expect(obtener).toHaveBeenCalledWith(ID_PEDIDO);
  });

  it('muestra el estado actual, la última actualización y la fecha estimada de entrega', () => {
    const contenido = texto(crear().nativeElement);

    expect(contenido).toContain('Enviado');
    expect(contenido).toContain('Última actualización');
    expect(contenido).toContain('Entrega estimada: sábado, 7 de noviembre');
  });

  it('muestra los pasos del envío, marcando los alcanzados y el actual', () => {
    const fixture = crear();
    const pasos: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.paso'));

    expect(pasos.map((p) => p.querySelector('strong')?.textContent?.trim())).toEqual([
      'Pagado',
      'En preparación',
      'Enviado',
      'En reparto',
      'Entregado',
    ]);
    expect(pasos.filter((p) => p.classList.contains('completado'))).toHaveLength(3);
    expect(pasos[2].getAttribute('aria-current')).toBe('step');
    expect(texto(pasos[3])).toContain('Pendiente');
  });

  it('cuando ya se ha entregado, muestra cuándo en lugar de la estimación', () => {
    obtener.mockReturnValue(
      of(
        seguimiento({
          estado: 'ENTREGADO',
          fechaEntregaEstimada: null,
          fechaEntrega: '2026-11-05T12:00:00Z',
        }),
      ),
    );
    const contenido = texto(crear().nativeElement);

    expect(contenido).toContain('Entregado el');
    expect(contenido).not.toContain('Entrega estimada');
  });

  it('si no hay seguimiento (pedido cancelado) lo explica en lugar de mostrar los pasos', () => {
    obtener.mockReturnValue(
      of(seguimiento({ estado: 'CANCELADO', disponible: false, pasos: [], fechaEntregaEstimada: null })),
    );
    const fixture = crear();

    expect(fixture.nativeElement.querySelector('.pasos')).toBeNull();
    expect(texto(fixture.nativeElement)).toContain('no tiene seguimiento de envío');
  });

  it('al pulsar Actualizar vuelve a pedirlo y muestra el estado más reciente', () => {
    const fixture = crear();
    obtener.mockReturnValue(of(seguimiento({ estado: 'EN_REPARTO' })));

    fixture.nativeElement.querySelector('.pie button').click();
    fixture.detectChanges();

    expect(obtener).toHaveBeenCalledTimes(2);
    expect(texto(fixture.nativeElement.querySelector('.resumen'))).toContain('En reparto');
  });

  it('si el backend falla muestra su mensaje', () => {
    obtener.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 404, error: { mensaje: 'El pedido no existe' } }),
      ),
    );
    expect(texto(crear().nativeElement)).toContain('El pedido no existe');
  });

  it('el botón de cerrar avisa a quien la abrió', () => {
    const fixture = crear();
    let cerrada = false;
    fixture.componentInstance.cerrar.subscribe(() => (cerrada = true));

    fixture.nativeElement.querySelector('button.cerrar').click();

    expect(cerrada).toBe(true);
  });
});
