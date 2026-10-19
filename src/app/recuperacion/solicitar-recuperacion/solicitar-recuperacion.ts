import { Component, DestroyRef, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { mensajeDe } from '../../registro/registro-mensajes';
import { emailValido } from '../../registro/registro-validadores';
import { ErrorRecuperacion, RecuperacionApiService } from '../recuperacion-api.service';

// Espera entre dos solicitudes, igual que el backend (60 s por cuenta). Solo es una ayuda visual: quien manda es el servidor.
const SEGUNDOS_DE_ESPERA = 60;

// Primera pantalla de la recuperación: el usuario escribe el correo de su cuenta y se le envía un enlace. La respuesta es
// siempre la misma exista o no la cuenta, así que esta pantalla tampoco puede confirmar si el correo está registrado.
@Component({
  selector: 'app-solicitar-recuperacion',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './solicitar-recuperacion.html',
  styleUrls: ['../recuperacion.css'],
})
export class SolicitarRecuperacion {
  private readonly api = inject(RecuperacionApiService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly form = this.fb.group({ email: ['', [emailValido()]] });

  readonly enviando = signal(false);
  // Tras un intento de envío se muestran los errores aunque el campo no se haya tocado.
  readonly intentado = signal(false);
  // Texto de confirmación que devuelve el backend; null mientras no se haya pedido.
  readonly confirmacion = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly segundosRestantes = signal(0);

  private temporizador: ReturnType<typeof setInterval> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.detenerCuentaAtras());
  }

  mensajesEmail(): string[] {
    const control = this.form.controls.email;
    if (!(control.touched || this.intentado())) {
      return [];
    }
    return Object.keys(control.errors ?? {}).map((codigo) => mensajeDe('email', codigo));
  }

  async enviar(): Promise<void> {
    if (this.enviando() || this.segundosRestantes() > 0) {
      return;
    }
    this.intentado.set(true);
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    try {
      this.confirmacion.set(await this.api.solicitar(this.form.controls.email.value.trim()));
      this.iniciarCuentaAtras();
    } catch (error) {
      if (!(error instanceof ErrorRecuperacion)) {
        throw error;
      }
      this.mostrar(error);
    } finally {
      this.enviando.set(false);
    }
  }

  private mostrar(error: ErrorRecuperacion): void {
    if (error.tipo === 'validacion') {
      this.error.set('Revisa el correo introducido.');
    } else if (error.correlationId) {
      this.error.set(`${error.message} Código para el soporte: ${error.correlationId}`);
    } else {
      this.error.set(error.message);
    }
  }

  private iniciarCuentaAtras(): void {
    this.detenerCuentaAtras();
    this.segundosRestantes.set(SEGUNDOS_DE_ESPERA);
    this.temporizador = setInterval(() => {
      this.segundosRestantes.update((restantes) => Math.max(0, restantes - 1));
      if (this.segundosRestantes() === 0) {
        this.detenerCuentaAtras();
      }
    }, 1000);
  }

  private detenerCuentaAtras(): void {
    if (this.temporizador !== undefined) {
      clearInterval(this.temporizador);
      this.temporizador = undefined;
    }
  }
}
