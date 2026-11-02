import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { MetodoPago, MetodoPagoService } from '../../cliente/metodo-pago.service';
import { AuthService } from '../../core/auth.service';
import { PerfilService, RespuestaPremium, formatearEuros } from '../perfil.service';

/** Mensaje del backend ({mensaje}) o uno genérico. */
function mensaje(e: unknown, porDefecto: string): string {
  return (e instanceof HttpErrorResponse ? e.error?.mensaje : null) ?? porDefecto;
}

/** Pantalla de pago de la suscripción Premium . El pago es simulado: no se cobra nada. */
@Component({
  selector: 'app-pago-premium',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './pago-premium.html',
})
export class PagoPremium {
  private readonly perfilService = inject(PerfilService);
  private readonly metodoPagoService = inject(MetodoPagoService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  protected readonly precio = signal<number | null>(null);
  protected readonly tarjetas = signal<MetodoPago[]>([]);
  protected readonly tarjetaElegida = signal<string | null>(null);
  protected readonly anadiendo = signal(false);
  protected readonly estado = signal<'cargando' | 'formulario' | 'procesando' | 'hecho'>('cargando');
  protected readonly justificante = signal<RespuestaPremium | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly formatearEuros = formatearEuros;

  // Mismas reglas que ServicioMetodoPago en el backend
  protected readonly nuevaTarjeta = this.fb.nonNullable.group({
    titular: ['', [Validators.required, Validators.maxLength(100)]],
    numeroTarjeta: ['', [Validators.required, Validators.pattern(/^[\d\s-]{12,23}$/)]],
    caducidad: ['', [Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])\/\d{2}$/)]],
    cvv: ['', [Validators.required, Validators.pattern(/^\d{3,4}$/)]],
  });

  constructor() {
    forkJoin({ precio: this.perfilService.precioPremium(), tarjetas: this.metodoPagoService.listar() }).subscribe({
      next: ({ precio, tarjetas }) => {
        this.precio.set(precio.importe);
        this.tarjetas.set(tarjetas);
        this.tarjetaElegida.set(tarjetas.length === 1 ? tarjetas[0].id : null);
        this.anadiendo.set(tarjetas.length === 0);
        this.estado.set('formulario');
      },
      error: (e) => {
        this.error.set(mensaje(e, 'No se ha podido cargar la página. Inténtalo de nuevo.'));
        this.estado.set('formulario');
      },
    });
  }

  protected invalido(campo: keyof typeof this.nuevaTarjeta.controls): boolean {
    const control = this.nuevaTarjeta.controls[campo];
    return control.touched && control.invalid;
  }

  /** desde esta pantalla: la tarjeta nueva queda elegida. */
  protected guardarTarjeta(): void {
    if (this.nuevaTarjeta.invalid) {
      this.nuevaTarjeta.markAllAsTouched();
      return;
    }
    this.error.set(null);
    this.metodoPagoService.anadir(this.nuevaTarjeta.getRawValue()).subscribe({
      next: (tarjeta) => {
        this.nuevaTarjeta.reset(); // no dejar el número ni el CVV en memoria
        this.tarjetas.update((lista) => [...lista, tarjeta]);
        this.tarjetaElegida.set(tarjeta.id);
        this.anadiendo.set(false);
      },
      error: (e) => {
        this.nuevaTarjeta.controls.cvv.reset();
        this.error.set(mensaje(e, 'No se ha podido guardar la tarjeta.'));
      },
    });
  }

  protected pagar(): void {
    const idMetodoPago = this.tarjetaElegida();
    if (!idMetodoPago) {
      this.error.set('Elige con qué tarjeta quieres pagar.');
      return;
    }
    this.estado.set('procesando');
    this.error.set(null);
    this.perfilService.pasarAPremium(idMetodoPago).subscribe({
      next: async (respuesta) => {
        this.justificante.set(respuesta);
        this.estado.set('hecho');
        await this.auth.restaurarSesion(); // la cabecera y los guards ven el rol PREMIUM
      },
      error: (e) => {
        this.estado.set('formulario');
        this.error.set(mensaje(e, 'No se ha podido completar el pago. Inténtalo de nuevo.'));
      },
    });
  }
}