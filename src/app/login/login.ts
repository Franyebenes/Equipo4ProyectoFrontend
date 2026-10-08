import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService, ErrorAutenticacion, Rol } from '../core/auth.service';

// Textos para los códigos de validación que devuelve el backend (400).
const TEXTOS_DE_VALIDACION: Record<string, string> = {
  OBLIGATORIO: 'Este campo es obligatorio.',
  FORMATO_INVALIDO: 'El formato no es válido.',
  LONGITUD_EXCESIVA: 'El valor es demasiado largo.',
};

// Zona de cada rol tras iniciar sesión. Los clientes, de momento, a la portada.
const RUTA_TRAS_LOGIN: Record<Rol, string> = {
  ADMIN: '/admin/categorias',
  VENDEDOR: '/vendedor/productos',
  CLIENTE: '/',
  PREMIUM: '/',
};

// Página de login: envía las credenciales al backend y, si son correctas, lleva al usuario a la zona de su rol.
@Component({
  selector: 'app-login',
  imports: [RouterLink, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  correo = '';
  contrasena = '';

  readonly enviando = signal(false);
  // Mensaje general (credenciales incorrectas, servicio caído...).
  readonly error = signal<string | null>(null);
  // Códigos de validación por campo del backend (400), p. ej. { email: ['FORMATO_INVALIDO'] }.
  readonly erroresCampo = signal<Record<string, string[]>>({});
  // Cuenta atrás cuando el backend bloquea temporalmente los intentos (429 con Retry-After).
  readonly segundosRestantes = signal(0);

  private temporizador: ReturnType<typeof setInterval> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.detenerCuentaAtras());
  }

  async enviar(evento: Event): Promise<void> {
    evento.preventDefault();
    if (this.enviando() || this.segundosRestantes() > 0) {
      return;
    }
    this.error.set(null);
    this.erroresCampo.set({});
    this.enviando.set(true);
    try {
      const usuario = await this.auth.login(this.correo.trim(), this.contrasena);
      this.contrasena = '';
      await this.router.navigateByUrl(RUTA_TRAS_LOGIN[usuario.rol]);
    } catch (error) {
      if (!(error instanceof ErrorAutenticacion)) {
        throw error;
      }
      this.mostrar(error);
    } finally {
      this.enviando.set(false);
    }
  }

  mensajesCampo(campo: string): string[] {
    return (this.erroresCampo()[campo] ?? []).map((codigo) => TEXTOS_DE_VALIDACION[codigo] ?? 'El valor no es válido.');
  }

  private mostrar(error: ErrorAutenticacion): void {
    switch (error.tipo) {
      case 'validacion':
        this.erroresCampo.set(error.detalle.errores ?? {});
        this.error.set(error.message);
        break;
      case 'bloqueado':
        this.error.set('Demasiados intentos fallidos.');
        this.iniciarCuentaAtras(error.detalle.reintentarEnSegundos ?? 0);
        break;
      case 'servidor':
        this.error.set(
          error.detalle.correlationId
            ? `${error.message} Código para el soporte: ${error.detalle.correlationId}`
            : error.message,
        );
        break;
      default:
        this.error.set(error.message);
    }
  }

  private iniciarCuentaAtras(segundos: number): void {
    this.detenerCuentaAtras();
    this.segundosRestantes.set(segundos);
    if (segundos <= 0) {
      return;
    }
    this.temporizador = setInterval(() => {
      this.segundosRestantes.update((restantes) => Math.max(0, restantes - 1));
      if (this.segundosRestantes() === 0) {
        this.detenerCuentaAtras();
        this.error.set(null);
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