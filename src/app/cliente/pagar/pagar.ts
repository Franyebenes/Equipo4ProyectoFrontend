import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { Carrito, CarritoService, LineaCarrito } from '../carrito.service';
import { MetodoPago, MetodoPagoService } from '../metodo-pago.service';
import { PagoService, ResultadoPago } from '../pago.service';

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

  readonly carrito = signal<Carrito | null>(null);
  readonly tarjetas = signal<MetodoPago[]>([]);
  readonly tarjetaElegida = signal<string | null>(null);
  readonly vendedorElegido = signal<string | null | undefined>(undefined); // undefined = sin elegir
  readonly cargando = signal(true);
  readonly pagando = signal(false);
  readonly error = signal<string | null>(null);
  readonly resultado = signal<ResultadoPago | null>(null);
  readonly quedanProductos = signal(false);

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

  readonly direccion = this.fb.nonNullable.group({
    calle: ['', [Validators.required, Validators.maxLength(150)]],
    ciudad: ['', [Validators.required, Validators.maxLength(80)]],
    codigoPostal: ['', [Validators.required, Validators.pattern(/^\d{5}$/)]],
  });

  ngOnInit(): void {
    forkJoin({ carrito: this.carritoService.obtener(), tarjetas: this.metodoPagoService.listar() }).subscribe({
      next: ({ carrito, tarjetas }) => {
        this.carrito.set(carrito);
        this.tarjetas.set(tarjetas);
        // Si solo tiene una tarjeta, ya viene elegida
        this.tarjetaElegida.set(tarjetas.length === 1 ? tarjetas[0].id : null);
        this.elegirVendedorInicial();
        this.cargando.set(false);
      },
      error: (e) => {
        this.mostrarError(e);
        this.cargando.set(false);
      },
    });
  }

  elegirVendedor(idVendedor: string | null): void {
    this.vendedorElegido.set(idVendedor);
    this.error.set(null);
  }

  elegirTarjeta(id: string): void {
    this.tarjetaElegida.set(id);
    this.error.set(null);
  }

  invalido(campo: 'calle' | 'ciudad' | 'codigoPostal'): boolean {
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
    this.pagoService
      .pagar({ idMetodoPago, direccionEnvio: this.direccion.getRawValue(), idVendedor: grupo.idVendedor })
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