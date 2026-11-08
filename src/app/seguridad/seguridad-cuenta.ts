import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { CodigosRecuperacion } from './codigos-recuperacion';
import { ActivacionIniciada, DosFactoresApiService, ErrorDosFactores, EstadoDosFactores } from './dos-factores-api.service';
import { QrDosFactores } from './qr-dos-factores';

// Textos para los códigos de validación que devuelve el backend (400).
const TEXTOS_DE_VALIDACION: Record<string, string> = {
  OBLIGATORIO: 'Este campo es obligatorio.',
  CONTRASENA_INCORRECTA: 'La contraseña no es correcta.',
  CODIGO_INCORRECTO: 'El código no es correcto. Comprueba que has escrito el último que muestra tu aplicación.',
  ACTIVACION_NO_VIGENTE: 'La activación ha caducado. Empieza de nuevo.',
};

// Pasos de la pantalla:
//  - cargando / error: se consulta el estado de la cuenta.
//  - inactivo: la cuenta no tiene la verificación en dos pasos.
//  - contrasena: se repite la contraseña para empezar la activación.
//  - escanear: QR (o clave) y primer código para confirmar.
//  - codigos: códigos de recuperación recién generados (se muestran una sola vez).
//  - activo: la verificación está activada.
//  - regenerar: contraseña y código para generar códigos de recuperación nuevos.
export type VistaSeguridad = 'cargando' | 'error' | 'inactivo' | 'contrasena' | 'escanear' | 'codigos' | 'activo' | 'regenerar';

// Seguridad de la cuenta: activar la verificación en dos pasos (TOTP, compatible con Google Authenticator) y regenerar los
// códigos de recuperación. Una vez activada queda fija: no hay forma de desactivarla ni de cambiarla desde la aplicación
// (decisión del PO para el prototipo). El secreto y los códigos solo viven en memoria mientras la pantalla está abierta.
@Component({
  selector: 'app-seguridad-cuenta',
  imports: [FormsModule, RouterLink, QrDosFactores, CodigosRecuperacion],
  templateUrl: './seguridad-cuenta.html',
  styleUrls: ['../recuperacion/recuperacion.css', './seguridad-cuenta.css'],
})
export class SeguridadCuenta {
  private readonly api = inject(DosFactoresApiService);

  readonly vista = signal<VistaSeguridad>('cargando');
  readonly estado = signal<EstadoDosFactores | null>(null);
  readonly enviando = signal(false);
  // Mensaje general (servicio caído, demasiados intentos...) y errores por campo del backend (400).
  readonly error = signal<string | null>(null);
  readonly erroresCampo = signal<Record<string, string[]>>({});
  // URI y secreto de la activación en curso, para el paso de escanear.
  readonly activacion = signal<ActivacionIniciada | null>(null);
  readonly codigosRecuperacion = signal<string[]>([]);
  readonly codigosGuardados = signal(false);
  readonly verContrasena = signal(false);

  contrasena = '';
  codigo = '';

  constructor() {
    // Al salir de la pantalla no se queda en memoria nada del secreto ni de los códigos
    inject(DestroyRef).onDestroy(() => this.olvidarSecretos());
    void this.cargar();
  }

  private async cargar(): Promise<void> {
    this.vista.set('cargando');
    this.limpiarMensajes();
    try {
      const estado = await this.api.estado();
      this.estado.set(estado);
      this.vista.set(estado.activo ? 'activo' : 'inactivo');
    } catch (error) {
      this.mostrar(error);
      this.vista.set('error');
    }
  }

  reintentar(): void {
    void this.cargar();
  }

  // ---------------------------------------------------------------- activación

  empezarActivacion(): void {
    this.limpiarMensajes();
    this.contrasena = '';
    this.vista.set('contrasena');
  }

  async pedirQr(evento: Event): Promise<void> {
    evento.preventDefault();
    if (this.enviando()) {
      return;
    }
    this.limpiarMensajes();
    this.enviando.set(true);
    try {
      this.activacion.set(await this.api.iniciarActivacion(this.contrasena));
      this.contrasena = '';
      this.codigo = '';
      this.vista.set('escanear');
    } catch (error) {
      this.mostrar(error);
    } finally {
      this.enviando.set(false);
    }
  }

  async confirmar(evento: Event): Promise<void> {
    evento.preventDefault();
    if (this.enviando()) {
      return;
    }
    this.limpiarMensajes();
    this.enviando.set(true);
    try {
      this.codigosRecuperacion.set(await this.api.confirmarActivacion(this.codigo));
      this.codigo = '';
      this.activacion.set(null);
      this.codigosGuardados.set(false);
      this.vista.set('codigos');
    } catch (error) {
      if (error instanceof ErrorDosFactores && error.errores['codigo']?.includes('ACTIVACION_NO_VIGENTE')) {
        // El secreto pendiente caducó: hay que pedir otro QR
        this.olvidarSecretos();
        this.vista.set('inactivo');
        this.error.set(TEXTOS_DE_VALIDACION['ACTIVACION_NO_VIGENTE']);
      } else {
        this.mostrar(error);
      }
    } finally {
      this.enviando.set(false);
    }
  }

  cancelar(): void {
    this.olvidarSecretos();
    this.limpiarMensajes();
    this.vista.set(this.estado()?.activo ? 'activo' : 'inactivo');
  }

  // ---------------------------------------------------------------- códigos de recuperación

  empezarRegeneracion(): void {
    this.limpiarMensajes();
    this.contrasena = '';
    this.codigo = '';
    this.vista.set('regenerar');
  }

  async regenerar(evento: Event): Promise<void> {
    evento.preventDefault();
    if (this.enviando()) {
      return;
    }
    this.limpiarMensajes();
    this.enviando.set(true);
    try {
      this.codigosRecuperacion.set(await this.api.regenerarCodigos(this.contrasena, this.codigo));
      this.contrasena = '';
      this.codigo = '';
      this.codigosGuardados.set(false);
      this.vista.set('codigos');
    } catch (error) {
      this.mostrar(error);
    } finally {
      this.enviando.set(false);
    }
  }

  // Se han guardado los códigos: ya no se vuelven a mostrar.
  async terminar(): Promise<void> {
    this.olvidarSecretos();
    await this.cargar();
  }

  // ---------------------------------------------------------------- mensajes

  mensajesCampo(campo: string): string[] {
    return (this.erroresCampo()[campo] ?? []).map((codigo) => TEXTOS_DE_VALIDACION[codigo] ?? 'El valor no es válido.');
  }

  private mostrar(error: unknown): void {
    if (!(error instanceof ErrorDosFactores)) {
      throw error;
    }
    if (error.tipo === 'validacion') {
      this.erroresCampo.set(error.errores);
    } else if (error.correlationId) {
      this.error.set(`${error.message} Código para el soporte: ${error.correlationId}`);
    } else {
      this.error.set(error.message);
    }
  }

  private limpiarMensajes(): void {
    this.error.set(null);
    this.erroresCampo.set({});
  }

  private olvidarSecretos(): void {
    this.activacion.set(null);
    this.codigosRecuperacion.set([]);
    this.contrasena = '';
    this.codigo = '';
  }
}
