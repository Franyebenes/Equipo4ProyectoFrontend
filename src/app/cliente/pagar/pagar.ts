import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, forkJoin, catchError, map, of, switchMap, tap } from 'rxjs';

import { Carrito, CarritoService, LineaCarrito } from '../carrito.service';
import { MetodoPago, MetodoPagoService } from '../metodo-pago.service';
import { PagoService, ResultadoPago } from '../pago.service';

import { AuthService } from '../../core/auth.service';
import { Direccion, DireccionService, lineaCalle } from '../../direcciones/direccion.service';

const TEXTO_SEGURO = /^[^<>{}$]*$/;
/** El que pide la libreta (01000-52999); para un envío sin guardar basta con 5 cifras */
const CODIGO_POSTAL_ES = /^(0[1-9]|[1-4]\d|5[0-2])\d{3}$/;

/** Productos del carrito de un mismo vendedor: cada compra es de un solo vendedor. */
export interface GrupoVendedor {
  idVendedor: string | null;
  nombre: string;
  lineas: LineaCarrito[];
  total: number;
  articulos: number;
  hayNoDisponibles: boolean;
}

// HU-23 Pago (ficticio): vendedor (si hay varios) + dirección de envío + tarjeta guardada + botón "Pagar"
@Component({
  selector: 'app-pagar',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './pagar.html',
  styleUrl: './pagar.css',
})
export class Pagar implements OnInit {
  private readonly carritoService = inject(CarritoService);
  private readonly metodoPagoService = inject(MetodoPagoService);
  private readonly pagoService = inject(PagoService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly direccionService = inject(DireccionService);
  private readonly auth = inject(AuthService);

  readonly carrito = signal<Carrito | null>(null);
  readonly tarjetas = signal<MetodoPago[]>([]);
  readonly tarjetaElegida = signal<string | null>(null);
  readonly vendedorElegido = signal<string | null | undefined>(undefined); // undefined = sin elegir
  readonly cargando = signal(true);
  readonly pagando = signal(false);
  readonly error = signal<string | null>(null);
  readonly resultado = signal<ResultadoPago | null>(null);
  readonly quedanProductos = signal(false);
  readonly direcciones = signal<Direccion[]>([]);
  readonly direccionElegida = signal<string | null>(null);
  readonly lineaCalle = lineaCalle;

  /** El carrito agrupado por vendedor, en el orden en que aparecen. */
  readonly grupos = computed<GrupoVendedor[]>(() => {
    const grupos = new Map<string, GrupoVendedor>();
    for (const linea of this.carrito()?.lineas ?? []) {
      const clave = linea.idVendedor ?? '';
      let grupo = grupos.get(clave);
      if (!grupo) {
        grupo = {
          idVendedor: linea.idVendedor,
          nombre: linea.nombreVendedor ?? 'Vendedor',
          lineas: [],
          total: 0,
          articulos: 0,
          hayNoDisponibles: false,
        };
        grupos.set(clave, grupo);
      }
      grupo.lineas.push(linea);
      if (linea.disponible) {
        grupo.total = Math.round((grupo.total + linea.subtotal) * 100) / 100;
        grupo.articulos += linea.cantidad;
      } else {
        grupo.hayNoDisponibles = true;
      }
    }
    return [...grupos.values()];
  });

  /** El grupo del vendedor elegido (o el único que hay). */
  readonly grupoElegido = computed<GrupoVendedor | null>(() => {
    const elegido = this.vendedorElegido();
    if (elegido === undefined) {
      return null;
    }
    return this.grupos().find((g) => g.idVendedor === elegido) ?? null;
  });

  /** Si la "Otra dirección" escrita a mano se guarda también en la libreta del cliente */
  readonly guardarDireccion = signal(false);

  // Mismos límites que la libreta de direcciones; destinatario y provincia solo hacen falta si se guarda
  readonly direccion = this.fb.nonNullable.group({
    calle: ['', [Validators.required, Validators.maxLength(100), Validators.pattern(TEXTO_SEGURO)]],
    numero: ['', [Validators.required, Validators.maxLength(10), Validators.pattern(TEXTO_SEGURO)]],
    pisoPuerta: ['', [Validators.maxLength(30), Validators.pattern(TEXTO_SEGURO)]],
    ciudad: ['', [Validators.required, Validators.maxLength(80), Validators.pattern(TEXTO_SEGURO)]],
    codigoPostal: ['', [Validators.required, Validators.pattern(/^\d{5}$/)]],
    destinatario: [''],
    provincia: [''],
  });

  ngOnInit(): void {
    forkJoin({ carrito: this.carritoService.obtener(), tarjetas: this.metodoPagoService.listar(), direcciones: this.direccionService.listar().pipe(catchError(() => of([] as Direccion[]))),
}).subscribe({
      next: ({ carrito, tarjetas, direcciones }) => {
        this.carrito.set(carrito);
        this.tarjetas.set(tarjetas);
        // Si solo tiene una tarjeta, ya viene elegida
        this.tarjetaElegida.set(tarjetas.length === 1 ? tarjetas[0].id : null);
        this.elegirVendedorInicial();
        this.cargando.set(false);
      
        this.direcciones.set(direcciones);
          const predeterminada =direcciones.find((d) => d.predeterminada);
            if (predeterminada) {
              this.elegirDireccion(predeterminada);
            }
      },
      error: (e) => {
        this.mostrarError(e);
        this.cargando.set(false);
      },
    });
  }

  /** Rellena el formulario con la dirección guardada y lo bloquea; null lo vacía para escribir otra. */
  elegirDireccion(direccion: Direccion | null): void {
    this.direccionElegida.set(direccion?.id ?? null);
    if (direccion) {
      this.cambiarGuardarDireccion(false);
      this.direccion.setValue({
        calle: direccion.calle,
        numero: direccion.numero,
        pisoPuerta: direccion.pisoPuerta ?? '',
        ciudad: direccion.ciudad,
        codigoPostal: direccion.codigoPostal,
        destinatario: direccion.destinatario,
        provincia: direccion.provincia,
      });
      this.direccion.disable(); // deshabilitado: invalid es false y getRawValue() sigue dando los valores
    } else {
      this.direccion.enable();
      this.direccion.reset();
    }
  }

  /** Al marcar "Guardar en mis direcciones" pasan a ser obligatorios los datos que pide la libreta. */
  cambiarGuardarDireccion(guardar: boolean): void {
    this.guardarDireccion.set(guardar);
    const { destinatario, provincia, codigoPostal } = this.direccion.controls;
    destinatario.setValidators(guardar ? [Validators.required, Validators.maxLength(100), Validators.pattern(TEXTO_SEGURO)] : []);
    provincia.setValidators(guardar ? [Validators.required, Validators.maxLength(80), Validators.pattern(TEXTO_SEGURO)] : []);
    codigoPostal.setValidators([Validators.required, Validators.pattern(guardar ? CODIGO_POSTAL_ES : /^\d{5}$/)]);
    if (guardar && !destinatario.value) {
      destinatario.setValue(this.auth.usuario()?.nombre ?? '');
    }
    for (const control of [destinatario, provincia, codigoPostal]) {
      control.updateValueAndValidity();
    }
  }

  elegirVendedor(idVendedor: string | null): void {
    this.vendedorElegido.set(idVendedor);
    this.error.set(null);
  }

  elegirTarjeta(id: string): void {
    this.tarjetaElegida.set(id);
    this.error.set(null);
  }

  invalido(campo: keyof typeof this.direccion.controls): boolean {
    const control = this.direccion.controls[campo];
    return control.invalid && control.touched;
  }

  pagar(): void {
    this.error.set(null);
    const grupo = this.grupoElegido();
    if (!grupo) {
      this.error.set('Elige de qué vendedor quieres hacer la compra.');
      return;
    }
    if (this.direccion.invalid) {
      this.direccion.markAllAsTouched();
      return;
    }
    const idMetodoPago = this.tarjetaElegida();
    if (!idMetodoPago) {
      this.error.set('Elige con qué tarjeta quieres pagar.');
      return;
    }
    this.pagando.set(true);
    this.idDireccionParaPago()
      .pipe(
        switchMap((idDireccion) => {
          const v = this.direccion.getRawValue();
          return this.pagoService.pagar({
            idMetodoPago,
            direccionEnvio: {
              calle: lineaCalle({ calle: v.calle, numero: v.numero, pisoPuerta: v.pisoPuerta.trim() || null }),
              ciudad: v.ciudad,
              codigoPostal: v.codigoPostal,
              idDireccion,
            },
            idVendedor: grupo.idVendedor,
          });
        }),
      )
      .subscribe({
        next: (resultado) => {
          this.resultado.set(resultado);
          this.pagando.set(false);
          // Solo sale del carrito lo de este vendedor: se recarga para actualizar el contador de la cabecera
          this.carritoService.obtener().subscribe({
            next: (c) => this.quedanProductos.set(c.lineas.length > 0),
          });
        },
        error: (e) => {
          this.mostrarError(e);
          this.pagando.set(false);
        },
      });
  }

  /**
   * Id de la dirección de la libreta con la que se paga. Si se ha pedido guardar la dirección nueva, antes se crea en
   * la libreta y se deja elegida: si luego falla el pago, al reintentar no se vuelve a crear.
   */
  private idDireccionParaPago(): Observable<string | null> {
    if (this.direccionElegida() !== null || !this.guardarDireccion()) {
      return of(this.direccionElegida());
    }
    const v = this.direccion.getRawValue();
    return this.direccionService
      .crear({
        destinatario: v.destinatario.trim(),
        calle: v.calle.trim(),
        numero: v.numero.trim(),
        pisoPuerta: v.pisoPuerta.trim() || null,
        codigoPostal: v.codigoPostal,
        ciudad: v.ciudad.trim(),
        provincia: v.provincia.trim(),
        predeterminada: this.direcciones().length === 0, // la primera que guarda pasa a ser la predeterminada
      })
      .pipe(
        tap((nueva) => {
          this.direcciones.update((lista) => [...lista, nueva]);
          this.elegirDireccion(nueva);
        }),
        map((nueva) => nueva.id),
      );
  }

  precio(importe: number): string {
    return importe.toFixed(2).replace('.', ',') + ' €';
  }

  // Si solo hay un vendedor, ya viene elegido. Si se llega desde el carrito con ?vendedor=..., se elige ese.
  private elegirVendedorInicial(): void {
    const grupos = this.grupos();
    const pedido = this.route.snapshot.queryParamMap.get('vendedor');
    const desdeCarrito = grupos.find((g) => g.idVendedor === pedido);
    if (desdeCarrito) {
      this.vendedorElegido.set(desdeCarrito.idVendedor);
    } else if (grupos.length === 1) {
      this.vendedorElegido.set(grupos[0].idVendedor);
    }
  }

  private mostrarError(e: unknown): void {
    const mensaje = e instanceof HttpErrorResponse ? e.error?.mensaje : null;
    this.error.set(mensaje ?? 'No se ha podido completar el pago. Inténtalo de nuevo.');
  }
}