import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';

import { MetodoPago, MetodoPagoService } from '../metodo-pago.service';

// La tarjeta vale hasta el final del mes indicado: "10/26" vale todo octubre de 2026
function tarjetaNoCaducada(control: AbstractControl): ValidationErrors | null {
  const partes = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(control.value ?? '');
  if (!partes) {
    return null; // el formato ya lo comprueba Validators.pattern
  }
  const hoy = new Date();
  const mesTarjeta = (2000 + Number(partes[2])) * 12 + (Number(partes[1]) - 1);
  const mesActual = hoy.getFullYear() * 12 + hoy.getMonth();
  return mesTarjeta < mesActual ? { caducada: true } : null;
}

// HU-24.1 Ver, HU-24.2 Añadir y HU-24.3 Eliminar métodos de pago
@Component({
  selector: 'app-metodos-pago',
  imports: [ReactiveFormsModule],
  templateUrl: './metodos-pago.html',
  styleUrl: './metodos-pago.css',
})
export class MetodosPago implements OnInit {
  private readonly servicio = inject(MetodoPagoService);
  private readonly fb = inject(FormBuilder);

  readonly metodos = signal<MetodoPago[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly mostrarFormulario = signal(false);
  readonly enviando = signal(false);
  readonly eliminando = signal<string | null>(null);

  readonly formulario = this.fb.nonNullable.group({
    titular: ['', [Validators.required, Validators.maxLength(100)]],
    numeroTarjeta: ['', [Validators.required, Validators.pattern(/^[\d\s-]{12,23}$/)]],
    caducidad: ['', [Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])\/\d{2}$/), tarjetaNoCaducada]],
    cvv: ['', [Validators.required, Validators.pattern(/^\d{3,4}$/)]],
  });

  ngOnInit(): void {
    this.servicio.listar().subscribe({
      next: (metodos) => {
        this.metodos.set(metodos);
        this.cargando.set(false);
      },
      error: (e) => {
        this.mostrarError(e);
        this.cargando.set(false);
      },
    });
  }

  abrirFormulario(): void {
    this.aviso.set(null);
    this.error.set(null);
    this.mostrarFormulario.set(true);
  }

  cancelar(): void {
    this.formulario.reset();
    this.mostrarFormulario.set(false);
  }

  invalido(campo: 'titular' | 'numeroTarjeta' | 'caducidad' | 'cvv'): boolean {
    const control = this.formulario.controls[campo];
    return control.invalid && control.touched;
  }

  guardar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.error.set(null);
    this.servicio.anadir(this.formulario.getRawValue()).subscribe({
      next: (metodo) => {
        this.metodos.update((lista) => [...lista, metodo]);
        // Se vacía el formulario: el número y el CVV no se quedan en la página
        this.formulario.reset();
        this.mostrarFormulario.set(false);
        this.enviando.set(false);
        this.aviso.set(`Tarjeta acabada en ${metodo.ultimosDigitos} añadida.`);
      },
      error: (e) => {
        this.mostrarError(e);
        this.enviando.set(false);
      },
    });
  }

  eliminar(metodo: MetodoPago): void {
    if (!confirm(`¿Eliminar la tarjeta acabada en ${metodo.ultimosDigitos}?`)) {
      return;
    }
    this.eliminando.set(metodo.id);
    this.error.set(null);
    this.aviso.set(null);
    this.servicio.eliminar(metodo.id).subscribe({
      next: () => {
        this.metodos.update((lista) => lista.filter((m) => m.id !== metodo.id));
        this.eliminando.set(null);
        this.aviso.set(`Tarjeta acabada en ${metodo.ultimosDigitos} eliminada.`);
      },
      error: (e) => {
        this.mostrarError(e);
        this.eliminando.set(null);
      },
    });
  }

  private mostrarError(e: unknown): void {
    const mensaje = e instanceof HttpErrorResponse ? e.error?.mensaje : null;
    this.error.set(mensaje ?? 'No se ha podido completar la operación. Inténtalo de nuevo.');
  }
}