import { NgTemplateOutlet } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { mensajeDe } from '../../registro/registro-mensajes';
import { contrasenaValida, contrasenasCoinciden } from '../../registro/registro-validadores';
import { ErrorRecuperacion, RecuperacionApiService } from '../recuperacion-api.service';

type CampoContrasena = 'contrasena' | 'repetirContrasena';

// El token que genera el backend: 256 bits en base64url sin relleno (43 caracteres).
const FORMATO_TOKEN = /^[A-Za-z0-9_-]{43}$/;

// Segunda pantalla de la recuperación: se llega desde el enlace del correo, que lleva el token en el fragmento de la URL
// (restablecer-contrasena#token=...). El navegador nunca envía el fragmento al servidor ni en el Referer, y aquí se lee
// una vez y se quita enseguida de la barra de direcciones: el token solo vive en memoria mientras la pantalla está abierta
// (no se guarda en ningún almacenamiento del navegador).
@Component({
  selector: 'app-restablecer-contrasena',
  imports: [ReactiveFormsModule, NgTemplateOutlet, RouterLink],
  templateUrl: './restablecer-contrasena.html',
  styleUrls: ['../recuperacion.css'],
})
export class RestablecerContrasena {
  private readonly api = inject(RecuperacionApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  readonly form = this.fb.group(
    {
      contrasena: ['', [contrasenaValida()]],
      repetirContrasena: ['', [contrasenaValida()]],
    },
    { validators: [contrasenasCoinciden] },
  );

  // Token del enlace; null si el enlace no lo traía o no tiene la forma de un token, o si el servidor lo ha rechazado.
  private token: string | null = null;
  // Sin enlace (o con uno que no vale) no hay nada que restablecer: se ofrece pedir otro.
  readonly enlaceInvalido = signal(true);
  readonly enviando = signal(false);
  // Tras un intento de envío se muestran todos los errores, aunque el campo no se haya tocado.
  readonly intentado = signal(false);
  readonly error = signal<string | null>(null);
  // Mensajes de la política de contraseñas que ha devuelto el servidor (todos a la vez).
  readonly erroresDelServidor = signal<string[]>([]);
  // Botones del ojo: muestran u ocultan cada contraseña por separado.
  readonly verContrasena = signal(false);
  readonly verRepetirContrasena = signal(false);

  constructor() {
    // Se escucha el fragmento (y no solo el del primer momento) para que abrir otro enlace con esta pantalla ya abierta
    // use el token nuevo. Al quitar el fragmento de la URL llega un valor vacío, que se ignora.
    this.ruta.fragment.pipe(takeUntilDestroyed()).subscribe((fragmento) => this.leerEnlace(fragmento ?? ''));
  }

  private leerEnlace(fragmento: string): void {
    if (fragmento === '') {
      return;
    }
    const candidato = new URLSearchParams(fragmento).get('token');
    this.token = candidato !== null && FORMATO_TOKEN.test(candidato) ? candidato : null;
    this.enlaceInvalido.set(this.token === null);
    this.error.set(null);
    this.erroresDelServidor.set([]);
    // El token sale de la barra de direcciones y del historial; se queda el resto de la URL.
    void this.router.navigate([], { relativeTo: this.ruta, fragment: undefined, replaceUrl: true });
  }

  // Mensajes de los errores del campo. Vacío mientras no haya que mostrarlos (campo sin tocar).
  mensajesError(campo: CampoContrasena): string[] {
    const control = this.form.controls[campo];
    if (!(control.touched || this.intentado())) {
      return [];
    }
    const codigos = Object.keys(control.errors ?? {});
    if (campo === 'repetirContrasena' && this.form.hasError('CONTRASENAS_NO_COINCIDEN')) {
      codigos.push('CONTRASENAS_NO_COINCIDEN');
    }
    const mensajes = codigos.map((codigo) => mensajeDe(campo, codigo));
    if (campo === 'contrasena') {
      mensajes.push(...this.erroresDelServidor());
    }
    return [...new Set(mensajes)];
  }

  ariaInvalid(campo: CampoContrasena): 'true' | null {
    return this.mensajesError(campo).length > 0 ? 'true' : null;
  }

  // Id del bloque de errores del campo, para enlazarlo con aria-describedby.
  ariaDescribedby(campo: CampoContrasena): string | null {
    return this.mensajesError(campo).length > 0 ? `error-${campo}` : null;
  }

  async enviar(): Promise<void> {
    if (this.enviando() || this.token === null) {
      return;
    }
    this.intentado.set(true);
    this.error.set(null);
    this.erroresDelServidor.set([]);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    try {
      await this.api.restablecer(this.token, this.form.controls.contrasena.value);
      this.token = null;
      this.form.reset();
      await this.router.navigateByUrl('/login', { state: { restablecida: true } });
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
      this.alRechazarElServidor(error.errores);
    } else if (error.correlationId) {
      this.error.set(`${error.message} Código para el soporte: ${error.correlationId}`);
    } else {
      this.error.set(error.message);
    }
  }

  // El servidor rechaza el enlace (el mismo error sea cual sea el motivo) o la contraseña (política de contraseñas).
  private alRechazarElServidor(errores: Record<string, string[]>): void {
    if (errores['token']?.length) {
      this.token = null;
      this.enlaceInvalido.set(true);
      return;
    }
    const delServidor = (errores['contrasena'] ?? []).map((codigo) => mensajeDe('contrasena', codigo));
    if (delServidor.length > 0) {
      this.erroresDelServidor.set(delServidor);
    } else {
      this.error.set('Revisa los datos introducidos.');
    }
  }
}
