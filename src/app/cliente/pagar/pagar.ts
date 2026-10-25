import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { Carrito, CarritoService } from '../carrito.service';
import { MetodoPago, MetodoPagoService } from '../metodo-pago.service';
import { PagoService, ResultadoPago } from '../pago.service';

// HU-23 Pago (ficticio): dirección de envío + tarjeta guardada + botón "Pagar"
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
  private readonly fb = inject(FormBuilder);

  readonly carrito = signal<Carrito | null>(null);
  readonly tarjetas = signal<MetodoPago[]>([]);
  readonly tarjetaElegida = signal<string | null>(null);
  readonly cargando = signal(true);
  readonly pagando = signal(false);
  readonly error = signal<string | null>(null);
  readonly resultado = signal<ResultadoPago | null>(null);

  /** Si hay productos desactivados en el carrito, el pedido no se puede tramitar hasta quitarlos. */
  readonly hayNoDisponibles = computed(() => this.carrito()?.lineas.some((l) => !l.disponible) ?? false);

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
        this.cargando.set(false);
      },
      error: (e) => {
        this.mostrarError(e);
        this.cargando.set(false);
      },
    });
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
    this.pagoService.pagar({ idMetodoPago, direccionEnvio: this.direccion.getRawValue() }).subscribe({
      next: (resultado) => {
        this.resultado.set(resultado);
        // El carrito se ha vaciado en el servidor: se pone a 0 el contador de la cabecera
        this.carritoService.numeroArticulos.set(0);
        this.pagando.set(false);
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

  private mostrarError(e: unknown): void {
    const mensaje = e instanceof HttpErrorResponse ? e.error?.mensaje : null;
    this.error.set(mensaje ?? 'No se ha podido completar el pago. Inténtalo de nuevo.');
  }
}