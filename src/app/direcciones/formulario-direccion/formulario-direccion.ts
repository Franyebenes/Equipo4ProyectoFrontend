import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { mensajeDeError } from '../../core/mensaje-error';
import { DatosDireccion, DireccionService } from '../direccion.service';

const TEXTO_SEGURO = /^[^<>{}$]*$/;
const CODIGO_POSTAL = /^(0[1-9]|[1-4][0-9]|5[0-2])[0-9]{3}$/;

/** Validadores de un texto: longitud máxima, sin caracteres prohibidos y, si se pide, obligatorio */
function texto(max: number, obligatorio = true) {
  const reglas = [Validators.maxLength(max), Validators.pattern(TEXTO_SEGURO)];
  return obligatorio ? [Validators.required, ...reglas] : reglas;
}

/** Alta y edición de una dirección. */
@Component({
  selector: 'app-formulario-direccion',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './formulario-direccion.html',
})
export class FormularioDireccion {
  private readonly servicio = inject(DireccionService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  /** null = alta; con valor = edición */
  protected readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id');
  protected readonly error = signal<string | null>(null);
  protected readonly guardando = signal(false);

  protected readonly formulario = this.fb.nonNullable.group({
    destinatario: ['', texto(100)],
    calle: ['', texto(100)],
    numero: ['', texto(10)],
    pisoPuerta: ['', texto(30, false)],
    codigoPostal: ['', [Validators.required, Validators.pattern(CODIGO_POSTAL)]],
    ciudad: ['', texto(80)],
    provincia: ['', texto(80)],
    predeterminada: [false],
  });

  constructor() {
    if (this.id) {
      this.servicio.obtener(this.id).subscribe({
        next: (d) => this.formulario.patchValue({ ...d, pisoPuerta: d.pisoPuerta ?? '' }),
        error: (e) => this.error.set(mensajeDeError(e)),
      });
    }
  }

  protected invalido(campo: keyof typeof this.formulario.controls): boolean {
    const control = this.formulario.controls[campo];
    return control.touched && control.invalid;
  }

  protected guardar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }
    const v = this.formulario.getRawValue();
    const datos: DatosDireccion = { ...v, pisoPuerta: v.pisoPuerta.trim() || null };
    const peticion = this.id ? this.servicio.modificar(this.id, datos) : this.servicio.crear(datos);

    this.guardando.set(true);
    this.error.set(null);
    peticion.subscribe({
      next: () => this.router.navigateByUrl('/direcciones'),
      error: (e) => {
        this.guardando.set(false);
        this.error.set(mensajeDeError(e)); // 409 si está en un pedido en curso o se ha llegado al límite
      },
    });
  }
}