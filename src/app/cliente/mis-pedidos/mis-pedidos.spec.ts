import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { EstadoPedido, HistorialPedidos, Pedido, PedidoService } from '../pedido.service';
import { MisPedidos } from './mis-pedidos';

const ID_PEDIDO = '64b000000000000000000101';

function pedido(estado: EstadoPedido): Pedido {
  return {
    id: ID_PEDIDO,
    estado,
    fecha: '2026-11-02T09:30:00Z',
    precioTotal: 36,
    direccionEnvio: { calle: 'Calle Mayor 1', ciudad: 'Ciudad Real', codigoPostal: '13001' },
    lineas: [
      { idProducto: 'p1', nombre: 'Teclado', cantidad: 2, precioUnitario: 18, subtotal: 36, valoracion: null },
    ],
  };
}

function enProceso(p: Pedido): HistorialPedidos {
  return { enProceso: [p], historicos: [] };
}

function boton(fixture: ComponentFixture<MisPedidos>, texto: string): HTMLButtonElement | undefined {
  const botones = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>);
  return botones.find((b) => (b.textContent ?? '').trim() === texto);
}

// El texto de la plantilla puede ir repartido en varias líneas: se juntan los espacios
function texto(elemento: HTMLElement): string {
  return (elemento.textContent ?? '').replace(/\s+/g, ' ');
}

describe('MisPedidos (cancelar y confirmar la recepción)', () => {
  let historial: ReturnType<typeof vi.fn>;
  let cancelar: ReturnType<typeof vi.fn>;
  let confirmarRecepcion: ReturnType<typeof vi.fn>;

  function crear(): ComponentFixture<MisPedidos> {
    TestBed.configureTestingModule({
      imports: [MisPedidos],
      providers: [
        provideRouter([]),
        { provide: PedidoService, useValue: { historial, cancelar, confirmarRecepcion, valorar: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(MisPedidos);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    historial = vi.fn();
    cancelar = vi.fn();
    confirmarRecepcion = vi.fn();
  });

  it.each(['PAGADO', 'EN_PREPARACION'] as const)(
    'un pedido %s aún no se ha enviado: se puede cancelar, pero no marcar como recibido',
    (estado) => {
      historial.mockReturnValue(of(enProceso(pedido(estado))));
      const fixture = crear();

      expect(boton(fixture, 'Cancelar pedido')).toBeDefined();
      expect(boton(fixture, 'He recibido el pedido')).toBeUndefined();
    },
  );

  it.each(['ENVIADO', 'EN_REPARTO'] as const)(
    'un pedido %s va de camino: ya no se puede cancelar ni marcar aún como recibido',
    (estado) => {
      historial.mockReturnValue(of(enProceso(pedido(estado))));
      const fixture = crear();

      expect(boton(fixture, 'Cancelar pedido')).toBeUndefined();
      expect(boton(fixture, 'He recibido el pedido')).toBeUndefined();
    },
  );

  it('un pedido entregado se puede marcar como recibido, pero ya no cancelar', () => {
    historial.mockReturnValue(of(enProceso(pedido('ENTREGADO'))));
    const fixture = crear();

    expect(boton(fixture, 'He recibido el pedido')).toBeDefined();
    expect(boton(fixture, 'Cancelar pedido')).toBeUndefined();
  });

  it('un pedido finalizado no ofrece seguimiento, cancelar ni confirmar la recepción', () => {
    historial.mockReturnValue(of({ enProceso: [], historicos: [pedido('FINALIZADO')] }));
    const fixture = crear();

    expect(boton(fixture, 'Seguimiento')).toBeUndefined();
    expect(boton(fixture, 'Cancelar pedido')).toBeUndefined();
    expect(boton(fixture, 'He recibido el pedido')).toBeUndefined();
  });

  it('«He recibido el pedido» pide confirmación y, si se cancela, el pedido no cambia', () => {
    historial.mockReturnValue(of(enProceso(pedido('ENTREGADO'))));
    const fixture = crear();

    boton(fixture, 'He recibido el pedido')!.click();
    fixture.detectChanges();
    expect(texto(fixture.nativeElement)).toContain('Pasará a «Finalizado» y podrás valorar sus productos');
    expect(confirmarRecepcion).not.toHaveBeenCalled();

    boton(fixture, 'Cancelar')!.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-dialogo-confirmacion')).toBeNull();
    expect(confirmarRecepcion).not.toHaveBeenCalled();
  });

  it('al confirmar la recepción, los botones del pedido siguen desactivados hasta que llega la lista nueva', () => {
    const recarga = new Subject<HistorialPedidos>();
    historial.mockReturnValueOnce(of(enProceso(pedido('ENTREGADO')))).mockReturnValueOnce(recarga);
    confirmarRecepcion.mockReturnValue(of(pedido('FINALIZADO')));
    const fixture = crear();
    const componente = fixture.componentInstance;

    boton(fixture, 'He recibido el pedido')!.click();
    componente.confirmarRecepcion();
    fixture.detectChanges();

    expect(confirmarRecepcion).toHaveBeenCalledWith(ID_PEDIDO);
    expect(boton(fixture, 'He recibido el pedido')!.disabled).toBe(true);

    recarga.next({ enProceso: [], historicos: [pedido('FINALIZADO')] });
    fixture.detectChanges();

    expect(componente.ocupado()).toBeNull();
    expect(boton(fixture, 'He recibido el pedido')).toBeUndefined();
    expect(boton(fixture, 'Cancelar pedido')).toBeUndefined();
    expect(texto(fixture.nativeElement)).toContain('Gracias por confirmar la recepción');
  });

  it('al cancelar, el botón sigue desactivado hasta que llega la lista nueva', () => {
    const recarga = new Subject<HistorialPedidos>();
    historial.mockReturnValueOnce(of(enProceso(pedido('PAGADO')))).mockReturnValueOnce(recarga);
    cancelar.mockReturnValue(of(pedido('CANCELADO')));
    const fixture = crear();
    const componente = fixture.componentInstance;

    boton(fixture, 'Cancelar pedido')!.click();
    componente.confirmarCancelacion();
    fixture.detectChanges();

    expect(cancelar).toHaveBeenCalledWith(ID_PEDIDO);
    expect(boton(fixture, 'Cancelar pedido')!.disabled).toBe(true);

    recarga.next({ enProceso: [], historicos: [pedido('CANCELADO')] });
    fixture.detectChanges();

    expect(componente.ocupado()).toBeNull();
    expect(boton(fixture, 'Cancelar pedido')).toBeUndefined();
  });

  it('si el backend rechaza la confirmación, muestra su mensaje y recarga la lista', () => {
    historial.mockReturnValue(of(enProceso(pedido('ENTREGADO'))));
    confirmarRecepcion.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: {
              mensaje:
                'Aún no puedes confirmar la recepción: el vendedor todavía no ha marcado el pedido como entregado',
            },
          }),
      ),
    );
    const fixture = crear();
    const componente = fixture.componentInstance;

    boton(fixture, 'He recibido el pedido')!.click();
    componente.confirmarRecepcion();
    fixture.detectChanges();

    expect(componente.errorAccion()).toContain('todavía no ha marcado el pedido como entregado');
    expect(historial).toHaveBeenCalledTimes(2);
    expect(componente.ocupado()).toBeNull();
  });
});
