import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService, ErrorAutenticacion, Rol } from '../core/auth.service';

// Textos para los códigos de validación que devuelve el backend (400).
const TEXTOS_DE_VALIDACION: Record<string, string> = {
  OBLIGATORIO: 'Este campo es obligatorio.',
  FORMATO_INVALIDO: 'El formato no es válido.',
  LONGITUD_EXCESIVA: 'El valor es demasiado largo.',
  CODIGO_INCORRECTO: 'El código no es correcto. Comprueba que has escrito el último que muestra tu aplicación.',
};

// Zona de cada rol tras iniciar sesión. Los clientes (Estándar y Premium), de momento, a una página que lo confirma.
const RUTA_TRAS_LOGIN: Record<Rol, string> = {
  ADMIN: '/admin/usuarios',
  VENDEDOR: '/vendedor/productos',
  CLIENTE: '/cliente',
  PREMIUM: '/cliente',
};

// Página de login: envía las credenciales al backend y, si son correctas, lleva al usuario a la zona de su rol. Si la cuenta
// tiene la verificación en dos pasos, pide además el código de la aplicación autenticadora (o uno de recuperación).
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
  // Botón del ojo: muestra u oculta la contraseña.
  readonly verContrasena = signal(false);
  // Segundo paso: la contraseña era correcta y la cuenta tiene la verificación en dos pasos, así que falta el código.
  readonly pideCodigo = signal(false);
  // El código es uno de recuperación (16 caracteres) en lugar del que muestra la aplicación (6 dígitos).
  readonly usaRecuperacion = signal(false);
  codigo = '';
  // Aviso de que la contraseña se acaba de restablecer (la pantalla de restablecimiento llega aquí con ese dato).
  readonly contrasenaRestablecida = signal(history.state?.restablecida === true);

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
      if (usuario === null) {
        // Contraseña correcta, pero falta el segundo factor: todavía no hay sesión
        this.pideCodigo.set(true);
        return;
      }
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

  async enviarCodigo(evento: Event): Promise<void> {
    evento.preventDefault();
    if (this.enviando()) {
      return;
    }
    this.error.set(null);
    this.erroresCampo.set({});
    this.enviando.set(true);
    try {
      const usuario = await this.auth.verificarSegundoFactor(this.codigo);
      this.codigo = '';
      await this.router.navigateByUrl(RUTA_TRAS_LOGIN[usuario.rol]);
    } catch (error) {
      if (!(error instanceof ErrorAutenticacion)) {
        throw error;
      }
      if (error.tipo === 'validacion') {
        // Se muestra junto al campo (código incorrecto, o vacío), sin un aviso general repetido
        this.erroresCampo.set(error.detalle.errores ?? {});
        return;
      }
      if (error.tipo === 'desafio') {
        // El segundo paso caducó o se agotaron los intentos: se vuelve a empezar por la contraseña
        this.volverALaContrasena();
      }
      this.mostrar(error);
    } finally {
      this.enviando.set(false);
    }
  }

  // Cambia entre el código de la aplicación y uno de recuperación.
  alternarRecuperacion(): void {
    this.usaRecuperacion.set(!this.usaRecuperacion());
    this.codigo = '';
    this.error.set(null);
    this.erroresCampo.set({});
  }

  // Vuelve al formulario de correo y contraseña (el desafío pendiente se sustituye al iniciar sesión de nuevo).
  volverALaContrasena(): void {
    this.pideCodigo.set(false);
    this.usaRecuperacion.set(false);
    this.codigo = '';
    this.error.set(null);
    this.erroresCampo.set({});
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
      case 'desafio':
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