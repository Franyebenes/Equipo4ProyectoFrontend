import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { PedidoRecibidoDetalle, PedidoVendedorService } from '../pedido-vendedor.service';
import { DetallePedidoRecibido } from './detalle-pedido-recibido';

const ID_PEDIDO = '64c000000000000000000101';

function pedido(cambios: Partial<PedidoRecibidoDetalle> = {}): PedidoRecibidoDetalle {
  return {
    id: ID_PEDIDO,
    fecha: '2026-11-02T09:30:00Z',
    cliente: 'Ana López',
    importe: 36,
    estado: 'PAGADO',
    unidades: 2,
    fechaActualizacion: '2026-11-02T09:30:00Z',
    estadosSiguientes: ['EN_PREPARACION', 'ENVIADO', 'EN_REPARTO', 'ENTREGADO'],
    direccionEnvio: { calle: 'Calle Mayor 1', ciudad: 'Ciudad Real', codigoPostal: '13001' },
    lineas: [{ idProducto: 'p1', nombre: 'Teclado', cantidad: 2, precioUnitario: 18, subtotal: 36 }],
    ...cambios,
  };
}

// El texto de la plantilla puede ir repartido en varias líneas: se juntan los espacios
function texto(elemento: HTMLElement): string {
  return (elemento.textContent ?? '').replace(/\s+/g, ' ');
}

describe('DetallePedidoRecibido (Ver pedidos recibidos y Procesar estado del pedido)', () => {
  let obtener: ReturnType<typeof vi.fn>;
  let cambiarEstado: ReturnType<typeof vi.fn>;

  function crear() {
    TestBed.configureTestingModule({
      imports: [DetallePedidoRecibido],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: ID_PEDIDO }),
              queryParamMap: convertToParamMap({}),
            },
          },
        },
        { provide: PedidoVendedorService, useValue: { obtener, cambiarEstado } },
      ],
    });
    const fixture = TestBed.createComponent(DetallePedidoRecibido);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    obtener = vi.fn().mockReturnValue(of(pedido()));
    cambiarEstado = vi.fn();
  });

  it('pide al backend el pedido de la dirección y muestra cliente, envío y productos', () => {
    const fixture = crear();
    const contenido = texto(fixture.nativeElement);

    expect(obtener).toHaveBeenCalledWith(ID_PEDIDO);
    expect(contenido).toContain('Pedido #00000101');
    expect(contenido).toContain('Ana López');
    expect(contenido).toContain('Calle Mayor 1');
    expect(contenido).toContain('Teclado');
    expect(contenido).toContain('Última actualización');
  });

  it('propone como nuevo estado el siguiente paso del envío', () => {
    const fixture = crear();
    const opciones = fixture.nativeElement.querySelectorAll('.estado-controles option');

    expect(fixture.componentInstance.nuevoEstado()).toBe('EN_PREPARACION');
    expect(Array.from(opciones, (o) => (o as HTMLOptionElement).textContent?.trim())).toEqual([
      'En preparación',
      'Enviado',
      'En reparto',
      'Entregado',
    ]);
  });

  it('pide confirmación antes de cambiar el estado', () => {
    const fixture = crear();
    fixture.nativeElement.querySelector('.estado-controles button').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-dialogo-confirmacion')).not.toBeNull();
    expect(cambiarEstado).not.toHaveBeenCalled();
  });

  it('al confirmar cambia el estado, muestra el pedido actualizado y lo avisa', () => {
    cambiarEstado.mockReturnValue(
      of(
        pedido({
          estado: 'EN_PREPARACION',
          fechaActualizacion: '2026-11-03T12:00:00Z',
          estadosSiguientes: ['ENVIADO', 'EN_REPARTO', 'ENTREGADO'],
        }),
      ),
    );
    const fixture = crear();
    const componente = fixture.componentInstance;

    componente.pedirConfirmacion();
    componente.confirmarCambio(componente.pedido()!);
    fixture.detectChanges();

    expect(cambiarEstado).toHaveBeenCalledWith(ID_PEDIDO, 'EN_PREPARACION');
    expect(componente.pedido()?.estado).toBe('EN_PREPARACION');
    expect(componente.nuevoEstado()).toBe('ENVIADO');
    expect(componente.confirmandoCambio()).toBe(false);
    expect(texto(fixture.nativeElement)).toContain(
      'Estado actualizado: el pedido está ahora «En preparación».',
    );
  });

  it('si el backend rechaza el cambio muestra su mensaje y vuelve a cargar el pedido', () => {
    cambiarEstado.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { mensaje: 'El pedido ha cambiado mientras lo actualizabas.' },
          }),
      ),
    );
    const fixture = crear();
    const componente = fixture.componentInstance;
    obtener.mockReturnValue(of(pedido({ estado: 'CANCELADO', estadosSiguientes: [] })));

    componente.pedirConfirmacion();
    componente.confirmarCambio(componente.pedido()!);
    fixture.detectChanges();

    expect(componente.errorEstado()).toBe('El pedido ha cambiado mientras lo actualizabas.');
    expect(obtener).toHaveBeenCalledTimes(2);
    expect(componente.pedido()?.estado).toBe('CANCELADO');
    expect(texto(fixture.nativeElement)).toContain('Este pedido ya está cancelado');
  });

  it('un pedido entregado ya no ofrece cambiar su estado', () => {
    obtener.mockReturnValue(of(pedido({ estado: 'ENTREGADO', estadosSiguientes: [] })));
    const fixture = crear();

    expect(fixture.nativeElement.querySelector('.estado-controles')).toBeNull();
    expect(texto(fixture.nativeElement)).toContain(
      'Este pedido ya está entregado: su estado no se puede cambiar.',
    );
  });

  it('si el pedido no es del vendedor muestra el mensaje del backend', () => {
    obtener.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 404, error: { mensaje: 'El pedido no existe' } }),
      ),
    );
    const fixture = crear();

    expect(texto(fixture.nativeElement)).toContain('El pedido no existe');
  });
});
